import { describe, expect, it } from 'vitest';

import { ensureUser } from '../../src/auth/authenticate.js';
import { AuthUnavailableError, type TokenVerifier } from '../../src/auth/token-verifier.js';
import type { PrismaClient } from '../../src/lib/prisma.js';
import { createTestApp } from '../helpers/app.js';
import { authHeaders, newAuthUser } from '../helpers/auth.js';
import { prisma } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';

describe('authentication', () => {
  it('leaves the health checks public', async () => {
    const { app } = await createTestApp();

    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: '/health/ready' })).statusCode).toBe(200);
  });

  it('protects every /api route, including the ones added in the future', async () => {
    const { app, routes } = await createTestApp();
    const apiRoutes = routes.filter(({ url }) => url.startsWith('/api'));
    expect(apiRoutes.length).toBeGreaterThan(0);

    for (const { method, url } of apiRoutes) {
      const concreteUrl = url.replace(/:\w+/g, '00000000-0000-4000-8000-000000000000');
      const response = await app.inject({ method: method as 'GET', url: concreteUrl });

      expect({ route: `${method} ${url}`, status: response.statusCode }).toEqual({
        route: `${method} ${url}`,
        status: 401,
      });
    }
    // Ogni route fuori da /api è dichiaratamente pubblica.
    expect(routes.filter(({ url }) => !url.startsWith('/api')).map(({ url }) => url)).toEqual([
      '/health',
      '/health/ready',
    ]);
  });

  it('answers 401 UNAUTHENTICATED with a Bearer challenge when the token is missing', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/me' });

    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer');
    expect(response.json()).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Missing bearer token' } });
  });

  it('answers 401 INVALID_TOKEN for an expired token', async () => {
    const { app } = await createTestApp();
    const headers = await authHeaders(newAuthUser(), { expiresAt: Math.floor(Date.now() / 1000) - 3600 });

    const response = await app.inject({ method: 'GET', url: '/api/me', headers });

    expect(response.statusCode).toBe(401);
    expect(response.headers['www-authenticate']).toBe('Bearer error="invalid_token"');
    expect(response.json().error.code).toBe('INVALID_TOKEN');
  });

  it('rejects the token before reading the body: no upload is ever parsed', async () => {
    const { app, storage } = await createTestApp();
    const form = new FormData();
    form.append('file', new Blob(['%PDF']), 'voucher.pdf');

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips/00000000-0000-4000-8000-000000000000/assets',
      payload: form,
    });

    expect(response.statusCode).toBe(401);
    expect(storage.objects.size).toBe(0);
  });

  it('answers 503 AUTH_UNAVAILABLE when the signing keys cannot be fetched', async () => {
    const unavailable: TokenVerifier = { verify: () => Promise.reject(new AuthUnavailableError()) };
    const { app } = await createTestApp({ tokenVerifier: unavailable });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: 'Bearer a.b.c' },
    });

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe('AUTH_UNAVAILABLE');
  });
});

describe('user provisioning', () => {
  it('creates the user on the first authenticated request', async () => {
    const user = newAuthUser();
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/me', headers: await authHeaders(user) });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: { id: user.id, email: user.email, createdAt: expect.any(String) },
    });
    expect(await prisma.user.count()).toBe(1);
  });

  it('tolerates losing the race to create the user to a parallel request', async () => {
    const user = newAuthUser();
    // L'altra richiesta ha già creato l'utente, ma questa lo aveva letto prima.
    await prisma.user.create({ data: user });
    const staleReads = Object.create(prisma, {
      user: {
        value: {
          findUnique: () => Promise.resolve(null),
          create: prisma.user.create.bind(prisma.user),
          createMany: prisma.user.createMany.bind(prisma.user),
          update: prisma.user.update.bind(prisma.user),
        },
      },
    }) as PrismaClient;

    await expect(ensureUser(staleReads, user)).resolves.toBeUndefined();
    expect(await prisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  it('keeps the stored email in sync with Supabase', async () => {
    const user = await createUser({ email: 'old@example.test' });
    const { app } = await createTestApp();

    await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: await authHeaders({ id: user.id, email: 'new@example.test' }),
    });

    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe('new@example.test');
  });

  it('does not erase the stored email when a token carries none', async () => {
    const user = await createUser({ email: 'kept@example.test' });
    const { app } = await createTestApp();

    await app.inject({ method: 'GET', url: '/api/me', headers: await authHeaders({ id: user.id }) });

    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe('kept@example.test');
  });
});
