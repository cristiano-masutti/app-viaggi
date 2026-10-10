import { describe, expect, it } from 'vitest';

import type { PrismaClient } from '../../src/lib/prisma.js';
import { createTestApp } from '../helpers/app.js';
import { prisma } from '../helpers/db.js';

describe('GET /health', () => {
  it('answers without touching the database', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });
});

describe('GET /health/ready', () => {
  it('is ready when the database answers', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok', checks: { database: 'ok' } });
  });

  it('answers 503 when the database is unreachable', async () => {
    const brokenPrisma = Object.create(prisma, {
      $queryRaw: { value: () => Promise.reject(new Error('connection refused')) },
    }) as PrismaClient;
    const { app } = await createTestApp({ prisma: brokenPrisma });

    const response = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ status: 'unavailable', checks: { database: 'error' } });
  });
});
