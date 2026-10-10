import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { asUser } from '../helpers/client.js';
import { prisma } from '../helpers/db.js';
import { createDocument, createMemory, createTripWithCrew, createUser } from '../helpers/factories.js';
import { PDF } from '../helpers/files.js';

type Who = 'coordinator' | 'traveller' | 'outsider' | 'staff';
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const MEMBERS: Who[] = ['coordinator', 'traveller'];
/** Lo staff (pannello di controllo) non è nella crew, ma organizza come un coordinatore. */
const COORDINATOR: Who[] = ['coordinator', 'staff'];
/** Le letture che servono anche allo staff: il viaggio e i suoi documenti, mai i ricordi. */
const MEMBERS_AND_STAFF: Who[] = ['coordinator', 'traveller', 'staff'];
/** I ricordi della fixture sono del viaggiatore: solo lui può modificarli. */
const AUTHOR: Who[] = ['traveller'];

/**
 * La tabella dei permessi di ogni route dentro un viaggio. Una route nuova
 * sotto /api/trips/:tripId senza una riga qui fa fallire il test: chi la
 * aggiunge deve decidere, per iscritto, chi può chiamarla.
 */
const TRIP_ROUTES: Array<{ method: Method; url: string; allowed: Who[]; payload?: object }> = [
  { method: 'GET', url: '/api/trips/:tripId', allowed: MEMBERS_AND_STAFF },
  { method: 'PATCH', url: '/api/trips/:tripId', allowed: COORDINATOR },
  { method: 'DELETE', url: '/api/trips/:tripId', allowed: COORDINATOR },

  { method: 'POST', url: '/api/trips/:tripId/invitations', allowed: COORDINATOR },
  { method: 'DELETE', url: '/api/trips/:tripId/invitations/:invitationId', allowed: COORDINATOR },
  { method: 'PATCH', url: '/api/trips/:tripId/members/:userId', allowed: COORDINATOR },
  { method: 'DELETE', url: '/api/trips/:tripId/members/:userId', allowed: COORDINATOR },
  { method: 'POST', url: '/api/trips/:tripId/leave', allowed: MEMBERS },
  { method: 'POST', url: '/api/trips/:tripId/invite-code', allowed: COORDINATOR },

  { method: 'POST', url: '/api/trips/:tripId/documents', allowed: COORDINATOR },
  { method: 'GET', url: '/api/trips/:tripId/documents/:documentId/url', allowed: MEMBERS_AND_STAFF },
  { method: 'DELETE', url: '/api/trips/:tripId/documents/:documentId', allowed: COORDINATOR },

  { method: 'PUT', url: '/api/trips/:tripId/days/:day/stay', allowed: COORDINATOR },
  { method: 'DELETE', url: '/api/trips/:tripId/days/:day/stay', allowed: COORDINATOR },
  { method: 'POST', url: '/api/trips/:tripId/days/:day/activities', allowed: COORDINATOR },
  { method: 'PATCH', url: '/api/trips/:tripId/activities/:activityId', allowed: COORDINATOR },
  { method: 'DELETE', url: '/api/trips/:tripId/activities/:activityId', allowed: COORDINATOR },

  { method: 'POST', url: '/api/trips/:tripId/transports', allowed: COORDINATOR },
  { method: 'PUT', url: '/api/trips/:tripId/transports/:transportId', allowed: COORDINATOR },
  { method: 'DELETE', url: '/api/trips/:tripId/transports/:transportId', allowed: COORDINATOR },
  { method: 'PUT', url: '/api/trips/:tripId/insurance', allowed: COORDINATOR },
  { method: 'DELETE', url: '/api/trips/:tripId/insurance', allowed: COORDINATOR },
  { method: 'PUT', url: '/api/trips/:tripId/customs', allowed: COORDINATOR },
  { method: 'DELETE', url: '/api/trips/:tripId/customs', allowed: COORDINATOR },
  { method: 'PUT', url: '/api/trips/:tripId/emergencies', allowed: COORDINATOR },

  { method: 'GET', url: '/api/trips/:tripId/memories', allowed: MEMBERS },
  { method: 'POST', url: '/api/trips/:tripId/memories', allowed: MEMBERS },
  {
    method: 'PATCH',
    url: '/api/trips/:tripId/memories/:memoryId',
    allowed: AUTHOR,
    // Body valido: il controllo sull'autore arriva dopo la validazione.
    payload: { caption: 'Cascata' },
  },
  { method: 'DELETE', url: '/api/trips/:tripId/memories/:memoryId', allowed: AUTHOR },
  { method: 'PUT', url: '/api/trips/:tripId/memories/:memoryId/reaction', allowed: MEMBERS },
  { method: 'DELETE', url: '/api/trips/:tripId/memories/:memoryId/reaction', allowed: MEMBERS },
  { method: 'GET', url: '/api/trips/:tripId/memories/:memoryId/media-url', allowed: MEMBERS },
];

const EXPECTED_DENIAL: Record<Who, number> = {
  coordinator: 403,
  traveller: 403,
  // Chi non è nel viaggio non deve nemmeno scoprire che esiste.
  outsider: 404,
  // Sulle route della crew (ricordi, uscita) lo staff è un estraneo come gli altri.
  staff: 404,
};

/** Un viaggio con almeno una cosa per tipo, così ogni route ha qualcosa su cui agire. */
async function setup() {
  const { app, routes, storage } = await createTestApp();
  const base = await createTripWithCrew();
  const crew = {
    ...base,
    staff: await createUser({ firstName: 'Giulia', lastName: 'Staff', isAdmin: true }),
  };
  const tripId = crew.trip.id;

  const document = await createDocument(tripId);
  const memory = await createMemory(tripId, crew.traveller.id, { kind: 'photo' });
  for (const path of [document.storagePath, memory.storagePath]) {
    storage.objects.set(path!, { body: PDF, contentType: 'application/pdf' });
  }
  await prisma.stay.create({ data: { tripId, dayIndex: 1, name: 'Hotel Kría', address: 'Vík' } });
  await prisma.insurance.create({ data: { tripId, company: 'Europ Assistance', policy: 'VM-1' } });
  await prisma.customs.create({ data: { tripId, code: 'KEF-1' } });
  const activity = await prisma.activity.create({
    data: { tripId, dayIndex: 1, name: 'Trekking', place: 'Sólheimajökull', position: 0 },
  });
  const transport = await prisma.transport.create({
    data: { tripId, name: 'Van 4x4', mode: 'van', position: 0 },
  });
  const invitation = await prisma.tripInvitation.create({ data: { tripId, name: 'Aisha' } });

  const ids: Record<string, string> = {
    tripId,
    day: '1',
    userId: crew.traveller.id,
    documentId: document.id,
    memoryId: memory.id,
    activityId: activity.id,
    transportId: transport.id,
    invitationId: invitation.id,
  };
  const url = (template: string) => template.replace(/:(\w+)/g, (_, key: string) => ids[key] ?? `:${key}`);

  return { app, routes, crew, url };
}

describe('trip access matrix', () => {
  it('lists every trip-scoped route', async () => {
    const { routes } = await setup();

    const tripScoped = routes
      .filter(({ url }) => url.startsWith('/api/trips/:tripId'))
      .map(({ method, url }) => `${method} ${url}`)
      .sort();

    expect(tripScoped).toEqual(TRIP_ROUTES.map(({ method, url }) => `${method} ${url}`).sort());
  });

  for (const route of TRIP_ROUTES) {
    for (const who of ['coordinator', 'traveller', 'outsider', 'staff'] as const) {
      const allowed = route.allowed.includes(who);

      it(`${route.method} ${route.url}: ${who} is ${allowed ? 'allowed' : 'denied'}`, async () => {
        const { app, crew, url } = await setup();
        const api = await asUser(app, crew[who]);

        const call = api[route.method.toLowerCase() as Lowercase<Method>];
        const response = await call(url(route.url), route.payload);

        if (allowed) {
          // Superato il controllo d'accesso: qualunque esito tranne un rifiuto.
          expect({ status: response.statusCode, body: response.body }).not.toMatchObject({
            status: expect.toBeOneOf([401, 403, 404]),
          });
        } else {
          expect(response.statusCode).toBe(EXPECTED_DENIAL[who]);
        }
      });
    }
  }

  it('answers 404 for a trip that does not exist, like for one that is not yours', async () => {
    const { app, crew } = await setup();
    const api = await asUser(app, crew.coordinator);

    for (const tripId of [randomUUID(), 'not-a-uuid']) {
      const response = await api.get(`/api/trips/${tripId}`);
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    }
  });

  it('explains a denied action to a member with 403 FORBIDDEN', async () => {
    const { app, crew, url } = await setup();
    const api = await asUser(app, crew.traveller);

    const response = await api.put(url('/api/trips/:tripId/insurance'), { company: 'X', policy: 'Y' });

    expect(response.json()).toEqual({
      error: { code: 'FORBIDDEN', message: 'This action requires one of the roles: coordinator' },
    });
  });

  it('lets staff organise as a coordinator, and stops the moment the role is revoked', async () => {
    const { app, crew, url } = await setup();
    const staff = await asUser(app, crew.staff);

    const trip = await staff.get(url('/api/trips/:tripId'));
    expect(trip.statusCode).toBe(200);
    expect(trip.json().trip.myRole).toBe('coordinator');
    // Lo staff organizza senza entrare nella crew.
    expect(trip.json().trip.crew.map((member: { userId: string }) => member.userId)).not.toContain(
      crew.staff.id,
    );

    await prisma.user.update({ where: { id: crew.staff.id }, data: { isAdmin: false } });
    expect((await staff.get(url('/api/trips/:tripId'))).statusCode).toBe(404);
  });

  it('gives staff who travel as travellers the powers of a coordinator on the organisation', async () => {
    const { app, crew, url } = await setup();
    await prisma.user.update({ where: { id: crew.traveller.id }, data: { isAdmin: true } });
    const api = await asUser(app, crew.traveller);

    const response = await api.put(url('/api/trips/:tripId/insurance'), {
      company: 'Europ Assistance',
      policy: 'VM-2',
    });

    expect(response.statusCode).toBe(200);
    // Nella crew resta quello che è: l'app gli mostra il viaggio da viaggiatore.
    expect((await api.get(url('/api/trips/:tripId'))).json().trip.myRole).toBe('traveller');
  });
});
