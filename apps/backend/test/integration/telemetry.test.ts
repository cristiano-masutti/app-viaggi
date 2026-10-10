import { describe, expect, it } from 'vitest';

import { DEFAULT_RETENTION_DAYS, pruneTelemetry } from '../../scripts/telemetry.js';
import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createTripWithCrew, createUser } from '../helpers/factories.js';

const now = () => new Date().toISOString();

describe('POST /api/telemetry', () => {
  it('stores usage events for the person who sends them, and anonymous samples', async () => {
    const { app } = await createTestApp();
    const { trip, traveller } = await createTripWithCrew();
    const api = await asUser(app, traveller);

    const response = await api.post('/api/telemetry', {
      source: 'app',
      platform: 'ios',
      appVersion: '1.2.0',
      events: [
        { name: 'app_open', occurredAt: now() },
        { name: 'screen_view', screen: 'TripDetail', tripId: trip.id, occurredAt: now() },
        { name: 'document_open', tripId: trip.id, occurredAt: now() },
      ],
      samples: [
        { metric: 'app_start', value: 1840, occurredAt: now() },
        { metric: 'api_latency', target: 'GET /api/trips/{tripId}', value: 212.5, occurredAt: now() },
      ],
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual({ events: 3, samples: 2 });
    const events = await prisma.appEvent.findMany({ orderBy: { name: 'asc' } });
    expect(
      events.map(({ userId, tripId, name, screen, platform }) => ({
        userId,
        tripId,
        name,
        screen,
        platform,
      })),
    ).toEqual([
      { userId: traveller.id, tripId: null, name: 'app_open', screen: null, platform: 'ios' },
      { userId: traveller.id, tripId: trip.id, name: 'screen_view', screen: 'TripDetail', platform: 'ios' },
      { userId: traveller.id, tripId: trip.id, name: 'document_open', screen: null, platform: 'ios' },
    ]);
    const samples = await prisma.perfSample.findMany({ orderBy: { metric: 'asc' } });
    expect(samples).toMatchObject([
      { metric: 'app_start', value: 1840, appVersion: '1.2.0', source: 'app' },
      { metric: 'api_latency', target: 'GET /api/trips/{tripId}', value: 212.5 },
    ]);
    // I campioni non dicono di chi sono.
    expect(Object.keys(samples[0]!)).not.toContain('userId');
  });

  it('does not let anyone count events on a trip they are not in', async () => {
    const { app } = await createTestApp();
    const { trip, outsider } = await createTripWithCrew();
    const api = await asUser(app, outsider);

    await api.post('/api/telemetry', {
      source: 'app',
      platform: 'android',
      events: [{ name: 'document_open', tripId: trip.id, occurredAt: now() }],
    });

    expect(await prisma.appEvent.findFirst()).toMatchObject({ userId: outsider.id, tripId: null });
  });

  it('brings implausible clocks back to now', async () => {
    const { app } = await createTestApp();
    const user = await createUser();
    const api = await asUser(app, user);
    const before = Date.now();

    await api.post('/api/telemetry', {
      source: 'app',
      platform: 'web',
      events: [
        { name: 'app_open', occurredAt: '2001-01-01T00:00:00.000Z' },
        { name: 'app_open', occurredAt: new Date(Date.now() + 3_600_000).toISOString() },
        { name: 'app_open', occurredAt: new Date(Date.now() - 10 * 86_400_000).toISOString() },
      ],
    });

    const instants = (await prisma.appEvent.findMany()).map((event) => event.occurredAt.getTime()).sort();
    expect(instants[0]).toBeLessThan(before - 9 * 86_400_000);
    expect(instants[1]).toBeGreaterThanOrEqual(before);
    expect(instants[2]).toBeGreaterThanOrEqual(before);
  });

  it('refuses free text, absurd values, oversized batches and usage events from the panel', async () => {
    const { app } = await createTestApp();
    const api = await asUser(app, await createUser());
    const base = { source: 'app', platform: 'ios' };

    for (const body of [
      { ...base, events: [{ name: 'screen_view', occurredAt: now() }] },
      { ...base, events: [{ name: 'screen_view', screen: '<script>alert(1)</script>', occurredAt: now() }] },
      { ...base, samples: [{ metric: 'slow_frames', value: 250, occurredAt: now() }] },
      { ...base, samples: [{ metric: 'app_start', value: -1, occurredAt: now() }] },
      { ...base, events: Array.from({ length: 51 }, () => ({ name: 'app_open', occurredAt: now() })) },
      { ...base, source: 'panel', events: [{ name: 'app_open', occurredAt: now() }] },
    ]) {
      expect((await api.post('/api/telemetry', body)).statusCode).toBe(400);
    }
    expect(await prisma.appEvent.count()).toBe(0);
  });

  it('needs a signed-in user', async () => {
    const { app } = await createTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/telemetry',
      payload: { source: 'app', platform: 'ios' },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe('npm run telemetry:prune', () => {
  it('deletes events and samples older than the retention, and nothing else', async () => {
    const user = await createUser();
    const old = new Date(Date.now() - (DEFAULT_RETENTION_DAYS + 1) * 86_400_000);
    const recent = new Date(Date.now() - 86_400_000);
    for (const occurredAt of [old, recent]) {
      await prisma.appEvent.create({
        data: { userId: user.id, name: 'app_open', platform: 'ios', occurredAt },
      });
      await prisma.perfSample.create({
        data: { source: 'app', platform: 'ios', metric: 'app_start', value: 1000, occurredAt },
      });
    }

    expect(await pruneTelemetry(prisma)).toMatchObject({ events: 1, samples: 1 });
    expect(await prisma.appEvent.count()).toBe(1);
    expect(await prisma.perfSample.count()).toBe(1);
    await expect(pruneTelemetry(prisma, 3)).rejects.toThrow(/almeno 7 giorni/);
  });

  it('removes the events of a person deleted from the database', async () => {
    const user = await createUser();
    await prisma.appEvent.create({
      data: { userId: user.id, name: 'app_open', platform: 'ios', occurredAt: new Date() },
    });
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.appEvent.count()).toBe(0);
  });
});
