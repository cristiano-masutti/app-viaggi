import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';
import { authHeaders } from '../helpers/auth.js';
import { prisma } from '../helpers/db.js';
import { createTripWithCrew } from '../helpers/factories.js';

type Who = 'coordinator' | 'traveller' | 'outsider';

/**
 * La tabella dei permessi di ogni route dentro un viaggio. Una route nuova
 * sotto /api/trips/:tripId senza una riga qui fa fallire il test: chi la
 * aggiunge deve decidere, per iscritto, chi può chiamarla.
 */
const TRIP_ROUTES: Array<{ method: 'GET' | 'POST'; url: string; allowed: Who[] }> = [
  { method: 'GET', url: '/api/trips/:tripId', allowed: ['coordinator', 'traveller'] },
  { method: 'POST', url: '/api/trips/:tripId/assets', allowed: ['coordinator'] },
  {
    method: 'GET',
    url: '/api/trips/:tripId/assets/:assetId/signed-url',
    allowed: ['coordinator', 'traveller'],
  },
];

const EXPECTED_DENIAL: Record<Who, number> = {
  coordinator: 403,
  traveller: 403,
  // Chi non è nel viaggio non deve nemmeno scoprire che esiste.
  outsider: 404,
};

async function setup() {
  const { app, routes } = await createTestApp();
  const crew = await createTripWithCrew();
  const asset = await prisma.tripAsset.create({
    data: {
      tripId: crew.trip.id,
      originalName: 'voucher.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 4,
      storagePath: `trips/${crew.trip.id}/voucher.pdf`,
    },
  });
  const url = (template: string) => template.replace(':tripId', crew.trip.id).replace(':assetId', asset.id);

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
    for (const who of ['coordinator', 'traveller', 'outsider'] as const) {
      const allowed = route.allowed.includes(who);

      it(`${route.method} ${route.url}: ${who} is ${allowed ? 'allowed' : 'denied'}`, async () => {
        const { app, crew, url } = await setup();

        const response = await app.inject({
          method: route.method,
          url: url(route.url),
          headers: await authHeaders(crew[who]),
        });

        if (allowed) {
          // Superato il controllo d'accesso: qualunque esito tranne un rifiuto.
          expect([401, 403, 404]).not.toContain(response.statusCode);
        } else {
          expect(response.statusCode).toBe(EXPECTED_DENIAL[who]);
        }
      });
    }
  }

  it('answers 404 for a trip that does not exist, like for one that is not yours', async () => {
    const { app, crew } = await setup();
    const headers = await authHeaders(crew.coordinator);

    for (const tripId of [randomUUID(), 'not-a-uuid']) {
      const response = await app.inject({ method: 'GET', url: `/api/trips/${tripId}`, headers });
      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe('NOT_FOUND');
    }
  });

  it('explains a denied action to a member with 403 FORBIDDEN', async () => {
    const { app, crew, url } = await setup();

    const response = await app.inject({
      method: 'POST',
      url: url('/api/trips/:tripId/assets'),
      headers: await authHeaders(crew.traveller),
    });

    expect(response.json()).toEqual({
      error: { code: 'FORBIDDEN', message: 'This action requires one of the roles: COORDINATOR' },
    });
  });
});
