import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { prisma } from '../helpers/db.js';
import { createTrip } from '../helpers/factories.js';

const validTrip = {
  title: 'Perù & Machu Picchu 🇵🇪',
  destination: 'Perù',
  startDate: '2026-12-13',
  endDate: '2026-12-27',
};

describe('POST /api/trips', () => {
  it('creates a trip and returns it with date-only fields', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'POST', url: '/api/trips', payload: validTrip });

    expect(response.statusCode).toBe(201);
    const { trip } = response.json();
    expect(trip).toEqual({
      id: expect.any(String),
      ...validTrip,
      assetCount: 0,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const stored = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
    expect(stored.startDate.toISOString()).toBe('2026-12-13T00:00:00.000Z');
    expect(stored.endDate.toISOString()).toBe('2026-12-27T00:00:00.000Z');
  });

  it('trims text fields and ignores unknown ones', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips',
      payload: { ...validTrip, title: '  Perù  ', id: '00000000-0000-0000-0000-000000000000' },
    });

    expect(response.statusCode).toBe(201);
    const { trip } = response.json();
    expect(trip.title).toBe('Perù');
    expect(trip.id).not.toBe('00000000-0000-0000-0000-000000000000');
  });

  it('rejects an end date before the start date with a VALIDATION_ERROR on endDate', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips',
      payload: { ...validTrip, endDate: '2026-12-01' },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request body',
        details: [{ path: '/endDate', message: 'endDate must be on or after startDate' }],
      },
    });
    expect(await prisma.trip.count()).toBe(0);
  });

  it('reports every invalid field at once', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips',
      payload: { title: 'A', startDate: '13/12/2026' },
    });

    expect(response.statusCode).toBe(400);
    const paths = response.json().error.details.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['/title', '/destination', '/startDate', '/endDate']));
  });
});

describe('GET /api/trips', () => {
  it('returns an empty list when there are no trips', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/trips' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ trips: [] });
  });

  it('lists the most recently created trips first, with their asset count', async () => {
    const older = await createTrip({
      title: 'Marocco Express 🇲🇦',
      createdAt: new Date('2026-01-01T10:00:00Z'),
    });
    const newer = await createTrip({
      title: 'Portogallo Surf 🇵🇹',
      createdAt: new Date('2026-02-01T10:00:00Z'),
    });
    await prisma.tripAsset.createMany({
      data: [1, 2].map((n) => ({
        tripId: older.id,
        originalName: `voucher-${n}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 100,
        storagePath: `trips/${older.id}/voucher-${n}.pdf`,
      })),
    });
    const { app } = await createTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/trips' });

    const { trips } = response.json();
    expect(trips.map((trip: { id: string }) => trip.id)).toEqual([newer.id, older.id]);
    expect(trips.map((trip: { assetCount: number }) => trip.assetCount)).toEqual([0, 2]);
  });
});
