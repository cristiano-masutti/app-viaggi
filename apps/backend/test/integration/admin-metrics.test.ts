import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createTrip, createUser } from '../helpers/factories.js';

const DAY = 86_400_000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const daysAgo = (days: number, hourUtc = 12) => {
  const date = new Date(Date.now() - days * DAY);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
};
const TODAY = isoDay(new Date());

async function asAdmin() {
  const { app } = await createTestApp();
  const admin = await createUser({ firstName: 'Giulia', lastName: 'Staff', isAdmin: true });
  return { app, api: await asUser(app, admin) };
}

function event(
  userId: string,
  daysBack: number,
  overrides: Partial<{
    name: 'app_open' | 'screen_view' | 'document_open';
    screen: string;
    tripId: string;
    platform: 'ios' | 'android' | 'web';
    hourUtc: number;
  }> = {},
) {
  const { name = 'app_open', screen = null, tripId = null, platform = 'ios', hourUtc = 12 } = overrides;
  return prisma.appEvent.create({
    data: { userId, name, screen, tripId, platform, occurredAt: daysAgo(daysBack, hourUtc) },
  });
}

describe('GET /api/admin/usage', () => {
  it('counts active people today, in 7 and in 30 days, and draws every day of the window', async () => {
    const { api } = await asAdmin();
    const [sofia, luca, aisha] = await Promise.all([createUser(), createUser(), createUser()]);
    await event(sofia.id, 0);
    await event(sofia.id, 0, { name: 'screen_view', screen: 'MyTrips' });
    await event(luca.id, 3, { name: 'document_open' });
    await event(aisha.id, 20, { platform: 'android' });
    await event(aisha.id, 45);

    const usage = (await api.get(`/api/admin/usage?days=7&today=${TODAY}`)).json();

    expect(usage.activeUsers).toEqual({ today: 1, week: 2, month: 3 });
    // Lo staff non conta fra le persone.
    expect(usage.people).toBe(3);
    expect(usage.daily).toHaveLength(7);
    expect(usage.daily.at(-1)).toEqual({ day: TODAY, activeUsers: 1, appOpens: 1, documentOpens: 0 });
    expect(usage.daily.at(-4)).toEqual({
      day: isoDay(daysAgo(3)),
      activeUsers: 1,
      appOpens: 0,
      documentOpens: 1,
    });
    expect(usage.daily[0]).toMatchObject({ activeUsers: 0 });
    expect(usage.screens).toEqual([{ screen: 'MyTrips', views: 1, users: 1 }]);
    expect(usage.platforms).toEqual([{ platform: 'ios', users: 2 }]);
  });

  it("puts each event in the viewer's day, not in UTC", async () => {
    const { api } = await asAdmin();
    const sofia = await createUser();
    // Ieri alle 23:30 UTC a Roma è già oggi (00:30 d'inverno, 01:30 d'estate).
    const lateLastNight = new Date(`${isoDay(daysAgo(1))}T23:30:00.000Z`);
    await prisma.appEvent.create({
      data: { userId: sofia.id, name: 'app_open', platform: 'ios', occurredAt: lateLastNight },
    });
    const activeOn = (usage: { daily: Array<{ day: string; activeUsers: number }> }, day: string) =>
      usage.daily.find((row) => row.day === day)?.activeUsers;

    const utc = (await api.get(`/api/admin/usage?days=7&today=${TODAY}&tz=UTC`)).json();
    const rome = (await api.get(`/api/admin/usage?days=7&today=${TODAY}&tz=Europe/Rome`)).json();

    expect([activeOn(utc, isoDay(daysAgo(1))), activeOn(utc, TODAY)]).toEqual([1, 0]);
    expect([activeOn(rome, isoDay(daysAgo(1))), activeOn(rome, TODAY)]).toEqual([0, 1]);
    expect((await api.get('/api/admin/usage?tz=Mars/Olympus')).statusCode).toBe(400);
  });

  it('lists who is in a trip but never opened the app, before who has not opened it in a while', async () => {
    const { api } = await asAdmin();
    const [sofia, luca, aisha, marco] = await Promise.all([
      createUser({ firstName: 'Sofia' }),
      createUser({ firstName: 'Luca' }),
      createUser({ firstName: 'Aisha' }),
      createUser({ firstName: 'Marco' }),
    ]);
    const soon = await createTrip({
      title: 'Giappone',
      startDate: daysAgo(-5, 0),
      endDate: daysAgo(-12, 0),
      members: [
        { user: sofia, role: 'coordinator' },
        { user: luca, role: 'traveller' },
        { user: aisha, role: 'traveller' },
      ],
    });
    await createTrip({
      title: 'Marocco',
      startDate: daysAgo(60, 0),
      endDate: daysAgo(55, 0),
      members: [{ user: marco, role: 'coordinator' }],
    });
    await event(sofia.id, 1);
    await event(luca.id, 20);

    const { inactive } = (await api.get('/api/admin/usage')).json();

    expect(inactive.total).toBe(2);
    expect(
      inactive.people.map((person: { firstName: string; lastSeenAt: string | null }) => [
        person.firstName,
        !!person.lastSeenAt,
      ]),
    ).toEqual([
      ['Aisha', false],
      ['Luca', true],
    ]);
    expect(inactive.people[0].trip).toMatchObject({ tripId: soon.id, title: 'Giappone' });
  });

  it('shows, for trips in progress, how much of the crew used the app this week', async () => {
    const { api } = await asAdmin();
    const [sofia, luca] = await Promise.all([createUser(), createUser()]);
    const live = await createTrip({
      title: 'Islanda',
      startDate: daysAgo(2, 0),
      endDate: daysAgo(-5, 0),
      members: [
        { user: sofia, role: 'coordinator' },
        { user: luca, role: 'traveller' },
      ],
    });
    await event(sofia.id, 0, { name: 'document_open', tripId: live.id });
    await event(sofia.id, 1, { name: 'document_open', tripId: live.id });

    const { liveTrips } = (await api.get('/api/admin/usage')).json();

    expect(liveTrips).toEqual([
      { tripId: live.id, title: 'Islanda', members: 2, activeMembers: 1, documentOpens: 2 },
    ]);
  });
});

describe('GET /api/admin/performance', () => {
  async function sample(
    metric: string,
    value: number,
    overrides: {
      target?: string;
      source?: 'app' | 'panel';
      platform?: 'ios' | 'android' | 'web';
      daysBack?: number;
    } = {},
  ) {
    const { target = null, source = 'app', platform = 'ios', daysBack = 0 } = overrides;
    await prisma.perfSample.create({
      data: { metric: metric as 'app_start', value, target, source, platform, occurredAt: daysAgo(daysBack) },
    });
  }

  it('summarises each metric with median, p75 and p95', async () => {
    const { api } = await asAdmin();
    for (const value of [1000, 2000, 3000, 4000, 5000]) await sample('app_start', value);
    await sample('app_start', 99_000, { source: 'panel', platform: 'web' });
    await sample('app_start', 1, { daysBack: 40 });

    const performance = (await api.get(`/api/admin/performance?today=${TODAY}`)).json();

    expect(performance.source).toBe('app');
    expect(performance.metrics).toEqual([{ metric: 'app_start', count: 5, p50: 3000, p75: 4000, p95: 4800 }]);
    expect(performance.daily).toEqual([{ day: TODAY, metric: 'app_start', p75: 4000, count: 5 }]);
    expect(performance.platforms).toEqual([{ platform: 'ios', metric: 'app_start', p75: 4000, count: 5 }]);
  });

  it('ranks screens and calls by where the time goes, and keeps the panel apart', async () => {
    const { api } = await asAdmin();
    for (const value of [300, 400]) await sample('screen_ready', value, { target: 'MyTrips' });
    for (const value of [1200, 2600]) await sample('screen_ready', value, { target: 'TripDetail' });
    await sample('api_latency', 180, { target: 'GET /api/trips' });
    await sample('lcp', 1900, { target: 'viaggi', source: 'panel', platform: 'web' });

    const app = (await api.get('/api/admin/performance')).json();
    const panel = (await api.get('/api/admin/performance?source=panel')).json();

    expect(
      app.targets.map((row: { metric: string; target: string }) => `${row.metric} ${row.target}`),
    ).toEqual(['screen_ready TripDetail', 'screen_ready MyTrips', 'api_latency GET /api/trips']);
    expect(panel.metrics).toEqual([{ metric: 'lcp', count: 1, p50: 1900, p75: 1900, p95: 1900 }]);
    expect(panel.targets).toEqual([
      { metric: 'lcp', target: 'viaggi', count: 1, p50: 1900, p75: 1900, p95: 1900 },
    ]);
  });
});

describe('last seen', () => {
  it('tells, for people and crew members, when they last used the app', async () => {
    const { api } = await asAdmin();
    const [sofia, luca] = await Promise.all([
      createUser({ firstName: 'Sofia' }),
      createUser({ firstName: 'Luca' }),
    ]);
    const trip = await createTrip({
      members: [
        { user: sofia, role: 'coordinator' },
        { user: luca, role: 'traveller' },
      ],
    });
    await event(sofia.id, 2);
    await event(sofia.id, 0, { name: 'document_open' });
    await event(sofia.id, 0, { name: 'screen_view', screen: 'TripDetail' });

    const people = (await api.get('/api/admin/users')).json().users;
    const crew = (await api.get(`/api/admin/trips/${trip.id}`)).json().trip.crew;
    const detail = (await api.get(`/api/admin/users/${sofia.id}`)).json().user;

    const seen = (list: Array<{ firstName: string; lastSeenAt: string | null }>, name: string) =>
      list.find((person) => person.firstName === name)?.lastSeenAt;
    expect(isoDay(new Date(seen(people, 'Sofia')!))).toBe(TODAY);
    expect(seen(people, 'Luca')).toBeNull();
    expect(isoDay(new Date(seen(crew, 'Sofia')!))).toBe(TODAY);
    expect(seen(crew, 'Luca')).toBeNull();
    expect(detail.usage).toEqual({ appOpens: 1, screenViews: 1, documentOpens: 1 });
  });
});
