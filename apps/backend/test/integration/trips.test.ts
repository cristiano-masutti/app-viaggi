import { describe, expect, it } from 'vitest';

import { TripRole } from '../../src/generated/prisma/enums.js';
import { createTestApp } from '../helpers/app.js';
import { authHeaders, newAuthUser } from '../helpers/auth.js';
import { prisma } from '../helpers/db.js';
import { createTrip, createTripWithCrew, createUser } from '../helpers/factories.js';

const validTrip = {
  title: 'Perù & Machu Picchu 🇵🇪',
  destination: 'Perù',
  startDate: '2026-12-13',
  endDate: '2026-12-27',
};

describe('POST /api/trips', () => {
  it('creates the trip with its creator as coordinator', async () => {
    const user = newAuthUser();
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: await authHeaders(user),
      payload: validTrip,
    });

    expect(response.statusCode).toBe(201);
    const { trip } = response.json();
    expect(trip).toEqual({
      id: expect.any(String),
      ...validTrip,
      myRole: 'COORDINATOR',
      assetCount: 0,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });

    const stored = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
      include: { members: true },
    });
    expect(stored.startDate.toISOString()).toBe('2026-12-13T00:00:00.000Z');
    expect(stored.endDate.toISOString()).toBe('2026-12-27T00:00:00.000Z');
    expect(stored.members).toEqual([
      expect.objectContaining({ userId: user.id, role: TripRole.COORDINATOR }),
    ]);
  });

  it('trims text fields and ignores unknown ones', async () => {
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/trips',
      headers: await authHeaders(newAuthUser()),
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
      headers: await authHeaders(newAuthUser()),
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
      headers: await authHeaders(newAuthUser()),
      payload: { title: 'A', startDate: '13/12/2026' },
    });

    expect(response.statusCode).toBe(400);
    const paths = response.json().error.details.map((issue: { path: string }) => issue.path);
    expect(paths).toEqual(expect.arrayContaining(['/title', '/destination', '/startDate', '/endDate']));
  });
});

describe('GET /api/trips', () => {
  it('returns an empty list to a user without trips', async () => {
    const { app } = await createTestApp();
    await createTripWithCrew();

    const response = await app.inject({
      method: 'GET',
      url: '/api/trips',
      headers: await authHeaders(newAuthUser()),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ trips: [] });
  });

  it('lists only my trips, most recent first, with my role and the asset count', async () => {
    const me = await createUser();
    const someoneElse = await createUser();
    const older = await createTrip({
      title: 'Marocco Express 🇲🇦',
      createdAt: new Date('2026-01-01T10:00:00Z'),
      members: [{ user: me, role: TripRole.TRAVELLER }],
    });
    const newer = await createTrip({
      title: 'Portogallo Surf 🇵🇹',
      createdAt: new Date('2026-02-01T10:00:00Z'),
      members: [{ user: me, role: TripRole.COORDINATOR }],
    });
    await createTrip({ title: 'Non mio', members: [{ user: someoneElse, role: TripRole.COORDINATOR }] });
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

    const response = await app.inject({ method: 'GET', url: '/api/trips', headers: await authHeaders(me) });

    const { trips } = response.json();
    expect(
      trips.map(({ id, myRole, assetCount }: Record<string, unknown>) => ({ id, myRole, assetCount })),
    ).toEqual([
      { id: newer.id, myRole: 'COORDINATOR', assetCount: 0 },
      { id: older.id, myRole: 'TRAVELLER', assetCount: 2 },
    ]);
  });
});

describe('GET /api/trips/:tripId', () => {
  it('returns the trip to a member, with their own role', async () => {
    const { trip, traveller } = await createTripWithCrew();
    const { app } = await createTestApp();

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${trip.id}`,
      headers: await authHeaders(traveller),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip).toMatchObject({ id: trip.id, title: trip.title, myRole: 'TRAVELLER' });
  });
});
