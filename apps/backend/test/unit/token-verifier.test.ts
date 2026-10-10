import { randomUUID } from 'node:crypto';

import { generateKeyPair, SignJWT, UnsecuredJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import { extractBearerToken } from '../../src/auth/authenticate.js';
import { AuthUnavailableError, createJwtVerifier, InvalidTokenError } from '../../src/auth/token-verifier.js';
import { newAuthUser, signToken, TEST_ISSUER, testTokenVerifier } from '../helpers/auth.js';

const user = newAuthUser();
const verify = (token: string) => testTokenVerifier.verify(token);
const nowSeconds = () => Math.floor(Date.now() / 1000);

describe('createJwtVerifier', () => {
  it('returns the user of a valid Supabase access token', async () => {
    await expect(verify(await signToken(user))).resolves.toEqual({ id: user.id, email: user.email });
  });

  it('returns a null email for users without one (phone login)', async () => {
    await expect(verify(await signToken({ id: user.id }))).resolves.toEqual({ id: user.id, email: null });
  });

  it('accepts a token that expired within the clock tolerance', async () => {
    const token = await signToken(user, { expiresAt: nowSeconds() - 5 });
    await expect(verify(token)).resolves.toMatchObject({ id: user.id });
  });

  it.each([
    ['expired', { expiresAt: nowSeconds() - 60 }],
    ['issued by another project', { issuer: 'https://other.supabase.co/auth/v1' }],
    ['meant for another audience', { audience: 'service' }],
    ['signed with an unknown key id', { kid: 'rotated-away' }],
    ['the anon API key', { claims: { role: 'anon' } }],
    ['the service_role API key', { claims: { role: 'service_role' } }],
    ['an anonymous user', { claims: { is_anonymous: true } }],
    ['not yet valid', { claims: { nbf: nowSeconds() + 600 } }],
  ])('rejects a token %s', async (_case, options) => {
    await expect(verify(await signToken(user, options))).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects a token whose subject is not a Supabase user id', async () => {
    const token = await signToken({ id: 'not-a-uuid' });
    await expect(verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects a token signed by a different key with the trusted key id', async () => {
    const forger = await generateKeyPair('ES256');
    const token = await signToken(user, { privateKey: forger.privateKey });

    await expect(verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects a token signed with a shared secret (HS256)', async () => {
    const token = await new SignJWT({ role: 'authenticated' })
      .setProtectedHeader({ alg: 'HS256', kid: 'test-signing-key' })
      .setSubject(user.id)
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-very-guessable-secret-of-32-bytes!'));

    await expect(verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects an unsigned token (alg: none)', async () => {
    const token = new UnsecuredJWT({ role: 'authenticated' })
      .setSubject(user.id)
      .setIssuer(TEST_ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .encode();

    await expect(verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects a token with a tampered payload', async () => {
    const [header, , signature] = (await signToken(user)).split('.');
    const payload = Buffer.from(
      JSON.stringify({ sub: randomUUID(), role: 'authenticated', iss: TEST_ISSUER, aud: 'authenticated' }),
    ).toString('base64url');

    await expect(verify(`${header}.${payload}.${signature}`)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it.each(['', 'garbage', 'a.b.c'])('rejects the malformed token %j', async (token) => {
    await expect(verify(token)).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('reports unavailable keys as an outage, not as a bad token', async () => {
    const verifier = createJwtVerifier({
      getKey: () => Promise.reject(new TypeError('fetch failed')),
      issuer: TEST_ISSUER,
      audience: 'authenticated',
    });

    await expect(verifier.verify(await signToken(user))).rejects.toBeInstanceOf(AuthUnavailableError);
  });
});

describe('extractBearerToken', () => {
  it.each([
    ['Bearer abc.def.ghi', 'abc.def.ghi'],
    ['bearer abc.def.ghi', 'abc.def.ghi'],
    ['Bearer   abc.def.ghi  ', 'abc.def.ghi'],
  ])('reads the token from %j', (header, token) => {
    expect(extractBearerToken(header)).toBe(token);
  });

  it.each([undefined, '', 'Bearer', 'Bearer ', 'Basic dXNlcjpwYXNz', 'abc.def.ghi', 'Bearer a b'])(
    'finds no token in %j',
    (header) => {
      expect(extractBearerToken(header)).toBeNull();
    },
  );
});
