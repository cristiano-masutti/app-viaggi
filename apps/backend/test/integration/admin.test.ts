import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createMemory, createTrip, createTripWithCrew, createUser } from '../helpers/factories.js';

const TODAY = '2027-09-18';
const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const createAdmin = () => createUser({ firstName: 'Giulia', lastName: 'Staff', isAdmin: true });

async function asAdmin() {
  const { app, accountAdmin, routes } = await createTestApp();
  const admin = await createAdmin();
  return { app, accountAdmin, routes, admin, api: await asUser(app, admin) };
}

/**
 * Le route del pannello. Una route nuova sotto /api/admin senza una riga qui fa
 * fallire il test: chi la aggiunge la vede provata contro chi non è staff.
 */
const ADMIN_ROUTES = [
  'GET /api/admin/session',
  'GET /api/admin/overview',
  'GET /api/admin/trips',
  'POST /api/admin/trips',
  'GET /api/admin/trips/:tripId',
  'POST /api/admin/trips/:tripId/members',
  'PATCH /api/admin/trips/:tripId/members/:userId',
  'DELETE /api/admin/trips/:tripId/members/:userId',
  'GET /api/admin/users',
  'GET /api/admin/users/:userId',
  'POST /api/admin/users',
];

describe('admin access', () => {
  it('lists every admin route', async () => {
    const { routes } = await createTestApp();
    const admin = routes
      .filter(({ url }) => url.startsWith('/api/admin'))
      .map(({ method, url }) => `${method} ${url}`);
    expect(admin.sort()).toEqual([...ADMIN_ROUTES].sort());
  });

  it('turns away everyone who is not staff, coordinators included, before reading the body', async () => {
    const { app } = await createTestApp();
    const { trip, coordinator } = await createTripWithCrew();
    const api = await asUser(app, coordinator);
    const ids: Record<string, string> = { tripId: trip.id, userId: coordinator.id };

    for (const route of ADMIN_ROUTES) {
      const [method, template] = route.split(' ') as [string, string];
      const url = template.replace(/:(\w+)/g, (_, key: string) => ids[key]!);
      const call = api[method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'];

      const response = await call(url, { not: 'validated' });
      expect({ route, status: response.statusCode }).toEqual({ route, status: 403 });
      expect(response.json().error.code).toBe('FORBIDDEN');

      const anonymous = await app.inject({ method: method as 'GET', url });
      expect({ route, status: anonymous.statusCode }).toEqual({ route, status: 401 });
    }
  });

  it('stops working the moment the role is revoked', async () => {
    const { api, admin } = await asAdmin();
    expect((await api.get('/api/admin/session')).statusCode).toBe(200);

    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: false } });

    expect((await api.get('/api/admin/session')).statusCode).toBe(403);
  });

  it('tells the browser not to keep a copy of personal data', async () => {
    const { api } = await asAdmin();
    const response = await api.get('/api/admin/users');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('says who is signed in', async () => {
    const { api, admin } = await asAdmin();
    expect((await api.get('/api/admin/session')).json()).toEqual({
      admin: { id: admin.id, email: admin.email, firstName: 'Giulia', lastName: 'Staff' },
    });
  });
});

/** Un viaggio per stato rispetto al 18/09/2027, con crew e logistica diverse. */
async function seedTrips() {
  const sofia = await createUser({
    firstName: 'Sofia',
    lastName: 'Marchi',
    passportNumber: 'YA9182773',
    passportExpiry: '04/2031',
  });
  const luca = await createUser({ firstName: 'Luca', lastName: 'Tosi' });
  const nico = await createUser({ firstName: 'Nico', lastName: 'Pace' });

  const iceland = await createTrip({
    title: 'Islanda On The Road 🇮🇸',
    destination: 'Islanda',
    startDate: date('2027-09-14'),
    endDate: date('2027-09-23'),
    crewCapacity: 6,
    members: [
      { user: sofia, role: 'coordinator' },
      { user: luca, role: 'traveller' },
    ],
  });
  const japan = await createTrip({
    title: 'Giappone Discovery 🇯🇵',
    destination: 'Giappone',
    startDate: date('2027-10-06'),
    endDate: date('2027-10-09'),
    crewCapacity: 4,
    members: [{ user: nico, role: 'coordinator' }],
  });
  const peru = await createTrip({
    title: 'Perù & Machu Picchu 🇵🇪',
    destination: 'Perù',
    startDate: date('2028-01-10'),
    endDate: date('2028-01-20'),
    members: [{ user: sofia, role: 'coordinator' }],
  });
  const morocco = await createTrip({
    title: 'Marocco Express 🇲🇦',
    destination: 'Marocco',
    startDate: date('2027-04-01'),
    endDate: date('2027-04-05'),
    members: [{ user: luca, role: 'coordinator' }],
  });

  // Il Giappone è pronto: 3 notti coperte, assicurazione, mezzo, SOS, passaporti.
  await prisma.user.update({
    where: { id: nico.id },
    data: { passportNumber: 'YB1', passportExpiry: '01/2032' },
  });
  await prisma.stay.createMany({
    data: [1, 2, 3].map((dayIndex) => ({
      tripId: japan.id,
      dayIndex,
      name: `Ryokan ${dayIndex}`,
      address: 'Kyoto',
    })),
  });
  await prisma.insurance.create({ data: { tripId: japan.id, company: 'Europ Assistance', policy: 'VM-1' } });
  await prisma.transport.create({ data: { tripId: japan.id, name: 'JR Pass', mode: 'van', position: 0 } });
  await prisma.emergencyContact.create({
    data: {
      tripId: japan.id,
      title: 'Ambasciata',
      actionLabel: 'Chiama',
      phone: '+81312345678',
      position: 0,
    },
  });
  await prisma.tripInvitation.create({
    data: { tripId: japan.id, name: 'Aisha', email: 'aisha@example.test' },
  });

  await createMemory(iceland.id, luca.id, { kind: 'photo' });
  await createMemory(iceland.id, luca.id, { kind: 'photo', visibility: 'private' });
  await createMemory(iceland.id, sofia.id);

  return { sofia, luca, nico, iceland, japan, peru, morocco };
}

describe('overview', () => {
  it('counts trips by status, people on the road and seats taken', async () => {
    const { api } = await asAdmin();
    const { iceland, japan, peru } = await seedTrips();
    await createUser({ firstName: 'Senza', lastName: 'Viaggi' });

    const overview = (await api.get(`/api/admin/overview?today=${TODAY}`)).json();

    expect(overview).toMatchObject({
      today: TODAY,
      trips: { ongoing: 1, upcoming: 2, past: 1 },
      // Sofia, Luca e Nico sono in viaggi in corso o futuri.
      activeTravellers: 3,
      // Lo staff non conta fra le persone.
      people: { total: 4, withoutTrips: 1 },
      // Islanda 2/6, Giappone 1 + 1 riserva / 4; il Perù non ha capienza.
      seats: { taken: 4, capacity: 10 },
      memoriesThisWeek: 3,
    });
    expect(overview.departures.map((trip: { id: string }) => trip.id)).toEqual([japan.id]);
    // Il Giappone è pronto; Islanda e Perù hanno qualcosa da sistemare, dal più vicino.
    expect(overview.attention.map((trip: { id: string }) => trip.id)).toEqual([iceland.id, peru.id]);
  });
});

describe('trips', () => {
  it('filters by status, the nearest first, the past from the most recent', async () => {
    const { api } = await asAdmin();
    const { iceland, japan, peru, morocco } = await seedTrips();
    const ids = async (query: string) =>
      (await api.get(`/api/admin/trips?today=${TODAY}&${query}`))
        .json()
        .trips.map((trip: { id: string }) => trip.id);

    expect(await ids('status=ongoing')).toEqual([iceland.id]);

    // Chi parte oggi e chi rientra oggi sono in viaggio.
    const leavingToday = await createTrip({ startDate: date(TODAY), endDate: date('2027-09-20') });
    const backToday = await createTrip({ startDate: date('2027-09-10'), endDate: date(TODAY) });
    expect(await ids('status=ongoing')).toEqual([backToday.id, iceland.id, leavingToday.id]);
    await prisma.trip.deleteMany({ where: { id: { in: [leavingToday.id, backToday.id] } } });
    expect(await ids('status=upcoming')).toEqual([japan.id, peru.id]);
    expect(await ids('status=past')).toEqual([morocco.id]);
    expect(await ids('')).toEqual([peru.id, japan.id, iceland.id, morocco.id]);
  });

  it('searches every word in title and destination, ignoring case, with the total for paging', async () => {
    const { api } = await asAdmin();
    const { japan, peru } = await seedTrips();

    const discovery = (await api.get(`/api/admin/trips?q=${encodeURIComponent('giappone DISCO')}`)).json();
    expect(discovery).toMatchObject({ total: 1, trips: [{ id: japan.id }] });

    const page = (await api.get(`/api/admin/trips?today=${TODAY}&status=upcoming&limit=1&offset=1`)).json();
    expect(page).toMatchObject({ total: 2, trips: [{ id: peru.id }] });
  });

  it('shows the card with crew, seats, readiness and media, never a passport number', async () => {
    const { api } = await asAdmin();
    const { iceland, sofia } = await seedTrips();

    const response = await api.get(`/api/admin/trips?today=${TODAY}&status=ongoing`);
    const [card] = response.json().trips;

    expect(card).toEqual({
      id: iceland.id,
      title: 'Islanda On The Road 🇮🇸',
      destination: 'Islanda',
      startDate: '2027-09-14',
      endDate: '2027-09-23',
      totalDays: 10,
      status: 'ongoing',
      crewCapacity: 6,
      members: 2,
      pendingInvitations: 0,
      coordinators: [{ userId: sofia.id, firstName: 'Sofia', lastName: 'Marchi' }],
      mediaCount: 2,
      readiness: {
        stays: { covered: 0, needed: 9 },
        insurance: false,
        transport: false,
        emergencyContacts: false,
        passports: { ready: 1, total: 2, expiring: 0 },
        issues: [
          'MISSING_STAYS',
          'NO_INSURANCE',
          'NO_TRANSPORT',
          'NO_EMERGENCY_CONTACTS',
          'MISSING_PASSPORTS',
        ],
      },
    });
    expect(response.body).not.toContain('YA9182773');
  });

  it('opens a trip: crew with contacts, reserved places, programme, logistics and memory counts', async () => {
    const { api } = await asAdmin();
    const { japan, nico } = await seedTrips();
    await prisma.activity.create({
      data: { tripId: japan.id, dayIndex: 2, name: 'Fushimi Inari', place: 'Kyoto', position: 0 },
    });

    const response = await api.get(`/api/admin/trips/${japan.id}?today=${TODAY}`);
    const trip = response.json().trip;

    expect(trip.crew).toEqual([
      {
        userId: nico.id,
        firstName: 'Nico',
        lastName: 'Pace',
        username: null,
        email: nico.email,
        role: 'coordinator',
        joinedAt: expect.any(String),
        passport: { present: true, expiry: '01/2032' },
      },
    ]);
    expect(trip.invitations).toEqual([
      { id: expect.any(String), name: 'Aisha', email: 'aisha@example.test', createdAt: expect.any(String) },
    ]);
    expect(trip.days).toHaveLength(4);
    expect(trip.days[1]).toEqual({
      index: 2,
      date: '2027-10-07',
      stay: { name: 'Ryokan 2', address: 'Kyoto', hasDocument: false },
      activities: [{ id: expect.any(String), name: 'Fushimi Inari', place: 'Kyoto', hasDocument: false }],
    });
    expect(trip.days[3].stay).toBeNull();
    expect(trip.logistics).toMatchObject({
      insurance: { company: 'Europ Assistance', policy: 'VM-1' },
      customs: null,
      transports: [{ name: 'JR Pass', mode: 'van' }],
      emergencies: [{ title: 'Ambasciata', phone: '+81312345678' }],
    });
    expect(trip.readiness.issues).toEqual([]);
    expect(trip).toMatchObject({ status: 'upcoming', inviteCode: japan.inviteCode });
  });

  it('counts every memory of a trip, private ones included, without showing them', async () => {
    const { api } = await asAdmin();
    const { iceland } = await seedTrips();

    const trip = (await api.get(`/api/admin/trips/${iceland.id}`)).json().trip;

    expect(trip.memories).toEqual({ photos: 2, videos: 0, notes: 1 });
  });

  it('answers 404 for a trip that does not exist', async () => {
    const { api } = await asAdmin();
    expect((await api.get(`/api/admin/trips/${randomUUID()}`)).statusCode).toBe(404);
  });
});

describe('creating a trip', () => {
  it('makes the chosen person its coordinator, without putting the staff in the crew', async () => {
    const { api, admin } = await asAdmin();
    const sofia = await createUser({ firstName: 'Sofia', lastName: 'Marchi' });

    const response = await api.post(`/api/admin/trips?today=${TODAY}`, {
      title: 'Norvegia Fiordi 🇳🇴',
      destination: 'Norvegia',
      startDate: '2027-11-02',
      endDate: '2027-11-08',
      crewCapacity: 8,
      coordinatorUserId: sofia.id,
    });

    expect(response.statusCode).toBe(201);
    const { trip } = response.json();
    expect(trip).toMatchObject({
      title: 'Norvegia Fiordi 🇳🇴',
      status: 'upcoming',
      totalDays: 7,
      crewCapacity: 8,
      members: 1,
      coordinators: [{ userId: sofia.id }],
      inviteCode: expect.stringMatching(/^norvegia-fiordi-/),
    });
    expect(await prisma.tripMember.count({ where: { tripId: trip.id, userId: admin.id } })).toBe(0);
  });

  it('refuses a coordinator who does not exist, and dates that go backwards', async () => {
    const { api } = await asAdmin();
    const sofia = await createUser();
    const body = {
      title: 'Norvegia',
      startDate: '2027-11-08',
      endDate: '2027-11-02',
      coordinatorUserId: sofia.id,
    };

    expect((await api.post('/api/admin/trips', body)).statusCode).toBe(400);
    expect(
      (
        await api.post('/api/admin/trips', {
          ...body,
          endDate: '2027-11-09',
          coordinatorUserId: randomUUID(),
        })
      ).statusCode,
    ).toBe(404);
  });
});

describe('trip crew', () => {
  it('adds a registered person with the chosen role', async () => {
    const { api } = await asAdmin();
    const { iceland } = await seedTrips();
    const aisha = await createUser({ firstName: 'Aisha', lastName: 'Bello' });

    const response = await api.post(`/api/admin/trips/${iceland.id}/members`, {
      userId: aisha.id,
      role: 'coordinator',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().member).toMatchObject({
      userId: aisha.id,
      role: 'coordinator',
      email: aisha.email,
    });
    expect(await prisma.tripMember.count({ where: { tripId: iceland.id } })).toBe(3);
  });

  it('takes the place reserved to that email, so a full trip still has room for them', async () => {
    const { api } = await asAdmin();
    const { japan } = await seedTrips();
    // Giappone: 1 membro + la riserva di Aisha + 2 posti presi = pieno (4).
    await prisma.trip.update({ where: { id: japan.id }, data: { crewCapacity: 2 } });
    const aisha = await createUser({ firstName: 'Aisha', lastName: 'Bello', email: 'aisha@example.test' });
    const stranger = await createUser({ firstName: 'Tea', lastName: 'Fabbri' });

    const full = await api.post(`/api/admin/trips/${japan.id}/members`, { userId: stranger.id });
    expect(full.statusCode).toBe(409);
    expect(full.json().error.code).toBe('TRIP_FULL');

    const reserved = await api.post(`/api/admin/trips/${japan.id}/members`, { userId: aisha.id });
    expect(reserved.statusCode).toBe(201);
    expect(reserved.json().member.role).toBe('traveller');
    expect(await prisma.tripInvitation.count({ where: { tripId: japan.id, acceptedAt: null } })).toBe(0);
  });

  it('refuses someone already in the trip, or who does not exist', async () => {
    const { api } = await asAdmin();
    const { iceland, luca } = await seedTrips();

    const again = await api.post(`/api/admin/trips/${iceland.id}/members`, { userId: luca.id });
    expect(again.statusCode).toBe(409);
    expect(again.json().error.code).toBe('ALREADY_MEMBER');

    expect(
      (await api.post(`/api/admin/trips/${iceland.id}/members`, { userId: randomUUID() })).statusCode,
    ).toBe(404);
    expect((await api.post(`/api/admin/trips/${randomUUID()}/members`, { userId: luca.id })).statusCode).toBe(
      404,
    );
  });

  it('changes roles and removes people, but never leaves a trip without a coordinator', async () => {
    const { api } = await asAdmin();
    const { iceland, sofia, luca } = await seedTrips();
    const base = `/api/admin/trips/${iceland.id}/members`;

    const demote = await api.patch(`${base}/${sofia.id}`, { role: 'traveller' });
    expect(demote.statusCode).toBe(409);
    expect(demote.json().error.code).toBe('LAST_COORDINATOR');
    expect((await api.delete(`${base}/${sofia.id}`)).json().error.code).toBe('LAST_COORDINATOR');

    expect((await api.patch(`${base}/${luca.id}`, { role: 'coordinator' })).json().member.role).toBe(
      'coordinator',
    );
    expect((await api.patch(`${base}/${sofia.id}`, { role: 'traveller' })).statusCode).toBe(200);
    expect((await api.delete(`${base}/${sofia.id}`)).statusCode).toBe(204);
    expect((await api.delete(`${base}/${sofia.id}`)).statusCode).toBe(404);

    const crew = await prisma.tripMember.findMany({ where: { tripId: iceland.id } });
    expect(crew.map(({ userId, role }) => ({ userId, role }))).toEqual([
      { userId: luca.id, role: 'coordinator' },
    ]);
  });
});

describe('people', () => {
  it('lists people from the newest, searchable by name, email or username', async () => {
    const { api } = await asAdmin();
    const older = await createUser({
      firstName: 'Sofia',
      lastName: 'Marchi',
      username: 'sofiam',
      createdAt: date('2025-01-01'),
    });
    const newer = await createUser({ firstName: 'Luca', lastName: 'Tosi', email: 'luca.tosi@example.test' });

    const all = (await api.get('/api/admin/users')).json();
    expect(all.total).toBe(3);
    expect(all.users[all.users.length - 1].id).toBe(older.id);

    for (const q of ['sofia marchi', 'SOFIAM', 'Marchi']) {
      expect((await api.get(`/api/admin/users?q=${encodeURIComponent(q)}`)).json().users).toEqual([
        expect.objectContaining({ id: older.id }),
      ]);
    }
    expect((await api.get('/api/admin/users?q=luca.tosi@')).json().users).toEqual([
      expect.objectContaining({ id: newer.id, tripCount: 0, isAdmin: false }),
    ]);
  });

  it('shows a person with their trips, and nothing of the private profile', async () => {
    const { api } = await asAdmin();
    const { sofia, iceland, peru } = await seedTrips();
    await prisma.user.update({
      where: { id: sofia.id },
      data: { medicalNotes: 'Allergia alle arachidi', fiscalCode: 'MRCSFO90A41H501X', diet: 'Vegetariana' },
    });

    const response = await api.get(`/api/admin/users/${sofia.id}?today=${TODAY}`);
    const user = response.json().user;

    expect(user).toMatchObject({
      id: sofia.id,
      firstName: 'Sofia',
      tripCount: 2,
      passport: { present: true, expiry: '04/2031' },
      trips: [
        { tripId: peru.id, status: 'upcoming', role: 'coordinator' },
        { tripId: iceland.id, status: 'ongoing', role: 'coordinator' },
      ],
    });
    for (const secret of ['arachidi', 'MRCSFO90A41H501X', 'Vegetariana', 'YA9182773']) {
      expect(response.body).not.toContain(secret);
    }
    expect((await api.get(`/api/admin/users/${randomUUID()}`)).statusCode).toBe(404);
  });
});

describe('creating an account', () => {
  it('creates it on Supabase with a temporary password returned once, and here with the name', async () => {
    const { api, accountAdmin } = await asAdmin();

    const response = await api.post('/api/admin/users', {
      email: 'Aisha.Bello@Example.test',
      firstName: 'Aisha',
      lastName: 'Bello',
    });

    expect(response.statusCode).toBe(201);
    const { user, temporaryPassword } = response.json();
    expect(temporaryPassword).toMatch(/^[a-z2-9]{4}(-[a-z2-9]{4}){3}$/);

    const account = accountAdmin.accounts.get('aisha.bello@example.test');
    expect(account).toMatchObject({ password: temporaryPassword, firstName: 'Aisha', lastName: 'Bello' });
    expect(user).toMatchObject({
      id: account!.id,
      email: 'aisha.bello@example.test',
      firstName: 'Aisha',
      tripCount: 0,
    });
    expect(await prisma.user.findUnique({ where: { id: account!.id } })).toMatchObject({
      firstName: 'Aisha',
    });
    // La password non resta da nessuna parte nel nostro database.
    expect(JSON.stringify(await prisma.user.findMany())).not.toContain(temporaryPassword);
  });

  it('refuses an email that already has an account, here or on Supabase', async () => {
    const { api, accountAdmin } = await asAdmin();
    await createUser({ email: 'luca@example.test' });
    accountAdmin.accounts.set('tea@example.test', {
      id: randomUUID(),
      email: 'tea@example.test',
      password: 'x',
      firstName: 'Tea',
      lastName: 'F',
    });

    for (const email of ['luca@example.test', 'TEA@example.test']) {
      const response = await api.post('/api/admin/users', { email, firstName: 'X', lastName: 'Y' });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe('EMAIL_TAKEN');
    }
  });

  it('creates nothing here when Supabase fails', async () => {
    const { api, accountAdmin } = await asAdmin();
    accountAdmin.failNext = true;

    const response = await api.post('/api/admin/users', {
      email: 'nina@example.test',
      firstName: 'Nina',
      lastName: 'R',
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().error.code).toBe('ACCOUNT_PROVIDER_ERROR');
    expect(await prisma.user.count({ where: { email: 'nina@example.test' } })).toBe(0);
  });

  it('validates the input', async () => {
    const { api } = await asAdmin();
    const response = await api.post('/api/admin/users', {
      email: 'not-an-email',
      firstName: '',
      lastName: 'Y',
    });
    expect(response.statusCode).toBe(400);
  });
});
