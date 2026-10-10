import { describe, expect, it } from 'vitest';

import type { PrismaClient } from '../../src/lib/prisma.js';
import { createTestApp } from '../helpers/app.js';
import { prisma } from '../helpers/db.js';

describe('error envelope', () => {
  it('answers 404 with ROUTE_NOT_FOUND for an unknown route', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/does-not-exist?x=1' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'ROUTE_NOT_FOUND', message: 'Route GET /api/does-not-exist not found' },
    });
  });

  it('answers 400 with BAD_REQUEST for malformed JSON', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: { 'content-type': 'application/json' },
      payload: '{"title": ',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BAD_REQUEST');
  });

  it('hides the details of an unexpected error behind a generic 500', async () => {
    const brokenPrisma = Object.create(prisma, {
      trip: {
        value: {
          findMany: () => Promise.reject(new Error('connection terminated: db.internal:5432')),
        },
      },
    }) as PrismaClient;
    const { app } = await createTestApp({ prisma: brokenPrisma });

    const response = await app.inject({ method: 'GET', url: '/api/trips' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
    expect(response.body).not.toContain('db.internal');
  });

  it('propagates the request id header for log correlation', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { 'x-request-id': 'req-from-proxy' },
    });

    expect(response.headers['x-request-id']).toBe('req-from-proxy');
  });
});
