import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  AuthUnavailableError,
  createSupabaseTokenVerifier,
  InvalidTokenError,
} from '../../src/auth/token-verifier.js';
import { newAuthUser, signToken, testJwks } from '../helpers/auth.js';

/**
 * Il verificatore di produzione contro un finto progetto Supabase in locale:
 * stesso percorso del JWKS, stesso issuer. Prova che l'URL è costruito giusto
 * e che un guasto di Supabase non diventa un 401 per l'utente.
 */
let server: Server;
let baseUrl: string;
let jwksResponse: { status: number; body: unknown };
let jwksRequests: string[];

beforeAll(async () => {
  server = createServer((request, response) => {
    jwksRequests.push(request.url ?? '');
    if (request.url !== '/auth/v1/.well-known/jwks.json') {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(jwksResponse.status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(jwksResponse.body));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  jwksResponse = { status: 200, body: testJwks };
  jwksRequests = [];
});

const tokenFor = (issuerBase: string) => signToken(newAuthUser(), { issuer: `${issuerBase}/auth/v1` });

describe('createSupabaseTokenVerifier', () => {
  it('verifies a token against the project JWKS and caches the keys', async () => {
    const verifier = createSupabaseTokenVerifier(`${baseUrl}/`);

    await expect(verifier.verify(await tokenFor(baseUrl))).resolves.toMatchObject({
      email: expect.any(String),
    });
    await expect(verifier.verify(await tokenFor(baseUrl))).resolves.toBeDefined();

    expect(jwksRequests).toEqual(['/auth/v1/.well-known/jwks.json']);
  });

  it('rejects a token from another Supabase project', async () => {
    const verifier = createSupabaseTokenVerifier(baseUrl);

    await expect(verifier.verify(await tokenFor('https://other.supabase.co'))).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('rejects every token when the project still uses the legacy shared secret (empty JWKS)', async () => {
    jwksResponse = { status: 200, body: { keys: [] } };
    const verifier = createSupabaseTokenVerifier(baseUrl);

    await expect(verifier.verify(await tokenFor(baseUrl))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('reports an outage when the JWKS endpoint fails', async () => {
    jwksResponse = { status: 500, body: { error: 'boom' } };
    const verifier = createSupabaseTokenVerifier(baseUrl);

    await expect(verifier.verify(await tokenFor(baseUrl))).rejects.toBeInstanceOf(AuthUnavailableError);
  });

  it('reports an outage when Supabase is unreachable', async () => {
    const verifier = createSupabaseTokenVerifier('http://127.0.0.1:1');

    await expect(verifier.verify(await tokenFor('http://127.0.0.1:1'))).rejects.toBeInstanceOf(
      AuthUnavailableError,
    );
  });
});
