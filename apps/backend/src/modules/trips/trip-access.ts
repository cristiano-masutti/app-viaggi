import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import { z } from 'zod';

import type { Trip, TripMember } from '../../generated/prisma/client.js';
import type { TripRole } from '../../generated/prisma/enums.js';
import { forbidden, notFound } from '../../lib/errors.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * Ruoli che possono chiamare la route. Assente = qualunque membro del
     * viaggio. Chi non è membro riceve sempre 404.
     */
    tripRoles?: readonly TripRole[];
  }

  interface FastifyRequest {
    /** La partecipazione dell'utente al viaggio della route, già verificata. */
    tripMember: TripMember;
    /** Il viaggio della route, caricato insieme alla partecipazione. */
    trip: Trip;
  }
}

export const TripParams = z.object({ tripId: z.uuid() });

const isUuid = (value: unknown): value is string => z.uuid().safeParse(value).success;

/**
 * Registra un gruppo di route che vivono dentro un viaggio
 * (`/trips/:tripId/...`). Prima di qualunque handler, e prima di leggere il
 * body, verifica che l'utente sia membro del viaggio e che il suo ruolo sia
 * fra quelli ammessi dalla route.
 *
 * È "deny by default": una route aggiunta qui dentro è protetta senza doverlo
 * ricordare, e una route senza `:tripId` nel percorso fa fallire l'avvio.
 */
export async function tripScope(app: FastifyInstance, register: (scope: FastifyInstance) => Promise<void>) {
  await app.register(async (scope) => {
    scope.addHook('onRoute', (route) => {
      if (!route.url.includes(':tripId')) {
        throw new Error(
          `Route ${route.method.toString()} ${route.url} is in the trip scope but has no :tripId`,
        );
      }
    });
    scope.addHook('onRequest', requireTripMember(scope));
    await register(scope);
  });
}

function requireTripMember(app: FastifyInstance): onRequestAsyncHookHandler {
  return async (request) => {
    const { tripId } = request.params as { tripId?: unknown };
    if (!isUuid(tripId)) throw notFound('Trip');

    const member = await app.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId: request.user.id } },
      include: { trip: true },
    });
    if (!member) throw notFound('Trip');

    const allowedRoles = request.routeOptions.config.tripRoles;
    if (allowedRoles && !allowedRoles.includes(member.role)) {
      throw forbidden(`This action requires one of the roles: ${allowedRoles.join(', ')}`);
    }

    const { trip, ...tripMember } = member;
    request.tripMember = tripMember;
    request.trip = trip;
  };
}

/** Scorciatoia per le route riservate a chi organizza il viaggio. */
export const COORDINATOR_ONLY = { tripRoles: ['coordinator'] } as const satisfies {
  tripRoles: readonly TripRole[];
};
