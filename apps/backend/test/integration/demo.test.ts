import { describe, expect, it } from 'vitest';

import { clearDemoData, DEMO_ACCOUNTS, seedDemo } from '../../scripts/demo.js';
import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';

const snapshot = () =>
  Promise.all([
    prisma.appEvent.findMany({
      select: { userId: true, tripId: true, name: true, screen: true, platform: true, occurredAt: true },
      orderBy: [{ occurredAt: 'asc' }, { userId: 'asc' }, { name: 'asc' }, { screen: 'asc' }],
    }),
    prisma.perfSample.aggregate({ _count: { _all: true }, _sum: { value: true } }),
    prisma.trip.findMany({ select: { id: true, inviteCode: true, startDate: true }, orderBy: { id: 'asc' } }),
  ]);

describe('demo seed', () => {
  it('writes the same data every time for the same instant (screenshots depend on it)', async () => {
    const now = new Date('2027-09-14T10:00:00.000Z');
    const first = await seedDemo(prisma, now);
    const before = await snapshot();

    await clearDemoData(prisma);
    const second = await seedDemo(prisma, now);

    expect(second).toEqual(first);
    expect(await snapshot()).toEqual(before);
    expect(first.events).toBeGreaterThan(500);
    expect(first.samples).toBeGreaterThan(1000);
  });

  it('gives the panel someone to chase: never seen first, then away for weeks', async () => {
    const now = new Date();
    await seedDemo(prisma, now);
    const { app } = await createTestApp();
    const staff = await asUser(app, DEMO_ACCOUNTS.staff);

    const usage = (await staff.get(`/api/admin/usage?today=${now.toISOString().slice(0, 10)}`)).json();

    expect(usage.inactive.people.map((person: { firstName: string }) => person.firstName)).toEqual([
      'Marco',
      'Omar',
      'Davide',
    ]);
    expect(
      usage.inactive.people.slice(0, 2).map((person: { lastSeenAt: null }) => person.lastSeenAt),
    ).toEqual([null, null]);
    expect(usage.liveTrips.map((trip: { title: string }) => trip.title)).toEqual([
      'Islanda On The Road 🇮🇸',
      'Lisbona & Sintra 🇵🇹',
    ]);
  });
});
