import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { newAuthUser } from '../helpers/auth.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import {
  createDocument,
  createMemory,
  createTrip,
  createTripWithCrew,
  createUser,
} from '../helpers/factories.js';

const draft = {
  title: 'Perù & Machu Picchu 🇵🇪',
  destination: 'Perù',
  startDate: '2026-12-13',
  endDate: '2026-12-17',
  crewCapacity: 10,
  invitees: [{ name: 'Aisha B.', email: 'Aisha.B@Gmail.com' }, { name: 'Tea F.' }],
  emergencies: [
    {
      title: '📣 Sofia • Coordinatore',
      actionLabel: 'Chiama il coordinatore',
      phone: '+39 333 123 4567',
      whatsapp: true,
    },
    { title: '🚨 112', actionLabel: 'Chiama 112', phone: '112' },
  ],
};

describe('POST /api/trips', () => {
  it('creates the trip from the CreateTripScreen draft, with the creator as coordinator', async () => {
    const user = await createUser({ firstName: 'Sofia', lastName: 'Marchi' });
    const { app } = await createTestApp();
    const api = await asUser(app, user);

    const response = await api.post('/api/trips', draft);

    expect(response.statusCode).toBe(201);
    const { trip } = response.json();
    expect(trip).toMatchObject({
      title: draft.title,
      destination: 'Perù',
      startDate: '2026-12-13',
      endDate: '2026-12-17',
      totalDays: 5,
      crewCapacity: 10,
      myRole: 'coordinator',
      crew: [{ userId: user.id, firstName: 'Sofia', lastName: 'Marchi', role: 'coordinator' }],
      invitations: [
        { name: 'Aisha B.', email: 'aisha.b@gmail.com' },
        { name: 'Tea F.', email: null },
      ],
      emergencies: [
        { title: '📣 Sofia • Coordinatore', phone: '+393331234567', whatsapp: true },
        { title: '🚨 112', phone: '112', whatsapp: false },
      ],
      documents: { passport: null, customs: null, transports: [], insurance: null },
    });
    expect(trip.inviteCode).toMatch(/^peru-machu-picchu-[a-z2-9]{12}$/);
    expect(trip.days.map((day: { index: number; date: string }) => [day.index, day.date])).toEqual([
      [1, '2026-12-13'],
      [2, '2026-12-14'],
      [3, '2026-12-15'],
      [4, '2026-12-16'],
      [5, '2026-12-17'],
    ]);
    expect(
      trip.days.every(
        (day: { stay: unknown; activities: unknown[] }) => !day.stay && day.activities.length === 0,
      ),
    ).toBe(true);
  });

  it('creates a trip from the minimal draft', async () => {
    const { app } = await createTestApp();
    const api = await asUser(app, newAuthUser());

    const response = await api.post('/api/trips', {
      title: 'Weekend',
      startDate: '2026-11-07',
      endDate: '2026-11-08',
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().trip).toMatchObject({
      destination: null,
      crewCapacity: null,
      invitations: [],
      emergencies: [],
    });
  });

  it.each([
    ['an end before the start', { endDate: '2026-12-01' }, '/endDate'],
    ['a trip longer than a year', { endDate: '2028-01-01' }, '/endDate'],
    [
      'an invalid phone number',
      { emergencies: [{ title: 'X', actionLabel: 'Chiama', phone: 'chiamami' }] },
      '/emergencies/0/phone',
    ],
    ['an invalid invitee email', { invitees: [{ name: 'Aisha', email: 'aisha' }] }, '/invitees/0/email'],
    ['a capacity of zero', { crewCapacity: 0 }, '/crewCapacity'],
    // Il creatore più i due posti riservati della bozza fanno tre.
    ['a capacity smaller than the creator and the invitees', { crewCapacity: 2 }, '/crewCapacity'],
  ])('rejects %s', async (_case, change, path) => {
    const { app } = await createTestApp();
    const api = await asUser(app, newAuthUser());

    const response = await api.post('/api/trips', { ...draft, ...change });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toContainEqual(expect.objectContaining({ path }));
    expect(await prisma.trip.count()).toBe(0);
  });
});

describe('GET /api/trips', () => {
  it('lists only my trips, latest departure first, with my role and counters', async () => {
    const me = await createUser();
    const friend = await createUser();
    const past = await createTrip({
      title: 'Marocco Express 🇲🇦',
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-08'),
      members: [
        { user: me, role: 'traveller' },
        { user: friend, role: 'coordinator' },
      ],
    });
    const next = await createTrip({
      title: 'Giappone Discovery 🇯🇵',
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-12'),
      members: [{ user: me, role: 'coordinator' }],
    });
    await createTrip({ title: 'Non mio', members: [{ user: friend, role: 'coordinator' }] });
    await prisma.tripInvitation.createMany({
      data: [
        { tripId: next.id, name: 'Aisha' },
        { tripId: next.id, name: 'Tea', acceptedAt: new Date() },
      ],
    });
    await createMemory(past.id, friend.id, { kind: 'photo' });
    await createMemory(past.id, friend.id, { kind: 'photo', visibility: 'private' });
    await createMemory(past.id, me.id, { kind: 'video', visibility: 'private' });
    await createMemory(past.id, me.id);
    const { app } = await createTestApp();

    const response = await (await asUser(app, me)).get('/api/trips');

    expect(response.statusCode).toBe(200);
    const { trips } = response.json();
    expect(trips).toEqual([
      expect.objectContaining({
        id: next.id,
        myRole: 'coordinator',
        totalDays: 12,
        pendingInvitations: 1,
        mediaCount: 0,
      }),
      // La foto privata dell'amico non si conta; il mio video privato sì; la nota non è un media.
      expect.objectContaining({
        id: past.id,
        myRole: 'traveller',
        totalDays: 8,
        pendingInvitations: 0,
        mediaCount: 2,
      }),
    ]);
    // Coordinatori per primi, come li mostra la card; mai dati privati dei compagni.
    expect(
      trips[1].crew.map((member: { userId: string; role: string }) => [member.userId, member.role]),
    ).toEqual([
      [friend.id, 'coordinator'],
      [me.id, 'traveller'],
    ]);
    expect(trips[1].crew[0]).not.toHaveProperty('email');
  });
});

describe('GET /api/trips/:tripId', () => {
  it('returns the whole trip, with my own passport and no private data about the crew', async () => {
    const { trip, coordinator, traveller } = await createTripWithCrew();
    await prisma.user.update({
      where: { id: traveller.id },
      data: {
        passportNumber: 'YA9182773',
        passportExpiry: '04/2029',
        medicalNotes: 'Allergia alle arachidi',
      },
    });
    await prisma.user.update({
      where: { id: coordinator.id },
      data: { passportNumber: 'AA0000001', passportExpiry: '01/2030' },
    });
    const { app } = await createTestApp();

    const response = await (await asUser(app, traveller)).get(`/api/trips/${trip.id}`);

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.trip).toMatchObject({
      myRole: 'traveller',
      totalDays: 10,
      documents: {
        passport: { number: 'YA9182773', expiry: '04/2029', hasPhoto: false, photoVersion: null },
      },
    });
    expect(body.trip.days).toHaveLength(10);
    expect(body.trip.crew.map((member: { role: string }) => member.role)).toEqual([
      'coordinator',
      'traveller',
    ]);
    for (const secret of ['AA0000001', 'Allergia', coordinator.email!, traveller.email!]) {
      expect(response.body).not.toContain(secret);
    }
  });
});

describe('PATCH /api/trips/:tripId', () => {
  it('updates the details and moves the whole programme with the dates', async () => {
    const { trip, coordinator } = await createTripWithCrew();
    await prisma.stay.create({ data: { tripId: trip.id, dayIndex: 3, name: 'Hotel Kría', address: 'Vík' } });
    const { app } = await createTestApp();

    const response = await (
      await asUser(app, coordinator)
    ).patch(`/api/trips/${trip.id}`, {
      title: 'Islanda in inverno',
      startDate: '2026-12-01',
      endDate: '2026-12-10',
      crewCapacity: null,
    });

    expect(response.statusCode).toBe(200);
    const updated = response.json().trip;
    expect(updated).toMatchObject({
      title: 'Islanda in inverno',
      startDate: '2026-12-01',
      crewCapacity: null,
    });
    // Il giorno 3 resta il giorno 3: cambia solo la sua data.
    expect(updated.days[2]).toMatchObject({ index: 3, date: '2026-12-03', stay: { name: 'Hotel Kría' } });
  });

  it('refuses to cut days that already have content', async () => {
    const { trip, coordinator, traveller } = await createTripWithCrew();
    await createMemory(trip.id, traveller.id, { dayIndex: 8 });
    const { app } = await createTestApp();

    const response = await (
      await asUser(app, coordinator)
    ).patch(`/api/trips/${trip.id}`, { endDate: '2026-09-20' });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({
      code: 'DAYS_HAVE_CONTENT',
      details: { lastDayWithContent: 8 },
    });
  });

  it('allows cutting empty days', async () => {
    const { trip, coordinator, traveller } = await createTripWithCrew();
    await createMemory(trip.id, traveller.id, { dayIndex: 7 });
    const { app } = await createTestApp();

    const response = await (
      await asUser(app, coordinator)
    ).patch(`/api/trips/${trip.id}`, { endDate: '2026-09-20' });

    expect(response.statusCode).toBe(200);
    expect(response.json().trip.totalDays).toBe(7);
  });

  it('checks the merged dates: a new start after the current end is refused', async () => {
    const { trip, coordinator } = await createTripWithCrew();
    const { app } = await createTestApp();

    const response = await (
      await asUser(app, coordinator)
    ).patch(`/api/trips/${trip.id}`, { startDate: '2026-10-01' });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.details).toEqual([
      { path: '/endDate', message: 'endDate must be on or after startDate' },
    ]);
  });

  it('refuses a capacity below the crew and its reserved places', async () => {
    const { trip, coordinator } = await createTripWithCrew();
    await prisma.tripInvitation.create({ data: { tripId: trip.id, name: 'Aisha' } });
    const { app } = await createTestApp();
    const api = await asUser(app, coordinator);

    const response = await api.patch(`/api/trips/${trip.id}`, { crewCapacity: 2 });

    expect(response.statusCode).toBe(409);
    expect(response.json().error).toMatchObject({
      code: 'CAPACITY_BELOW_CREW',
      details: { crewCount: 2, pendingInvitations: 1 },
    });
    expect((await api.patch(`/api/trips/${trip.id}`, { crewCapacity: 3 })).statusCode).toBe(200);
  });

  it('never leaves the programme outside the trip when the dates shrink while someone adds to the last day', async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { trip, coordinator } = await createTripWithCrew();
      const { app } = await createTestApp();
      const api = await asUser(app, coordinator);

      await Promise.all([
        api.patch(`/api/trips/${trip.id}`, { endDate: '2026-09-20' }),
        api.post(`/api/trips/${trip.id}/days/10/activities`, { name: 'Laguna Blu', place: 'Grindavík' }),
      ]);

      const { startDate, endDate } = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } });
      const lastDay = Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;
      expect(await prisma.activity.count({ where: { tripId: trip.id, dayIndex: { gt: lastDay } } })).toBe(0);
    }
  });
});

describe('DELETE /api/trips/:tripId', () => {
  it('deletes the trip for everyone, with all its files', async () => {
    const { trip, coordinator, traveller } = await createTripWithCrew();
    const document = await createDocument(trip.id);
    const photo = await createMemory(trip.id, traveller.id, { kind: 'photo' });
    const { app, storage } = await createTestApp();
    for (const path of [document.storagePath!, photo.storagePath!]) {
      storage.objects.set(path, { body: Buffer.from('x'), contentType: 'image/jpeg' });
    }

    const response = await (await asUser(app, coordinator)).delete(`/api/trips/${trip.id}`);

    expect(response.statusCode).toBe(204);
    expect(await prisma.trip.count()).toBe(0);
    expect(await prisma.memory.count()).toBe(0);
    expect(storage.objects.size).toBe(0);
    // Gli utenti restano: perdono solo il viaggio.
    expect(await prisma.user.count()).toBe(3);
  });
});
