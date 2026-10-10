import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';
import { z } from 'zod';

import type { Trip, TripMember } from '../../generated/prisma/client.js';
import { TripRole } from '../../generated/prisma/enums.js';
import { forbidden, notFound } from '../../lib/errors.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /**
     * Ruoli che possono chiamare la route. Assente = qualunque membro del
     * viaggio. Chi non è membro riceve sempre 404.
     */
    tripRoles?: readonly TripRole[];
    /**
     * Anche lo staff (pannello di controllo) può chiamare la route, come se
     * fosse coordinatore, senza far parte del viaggio. Solo le route che
     * organizzano il viaggio: mai quelle dei ricordi, che restano della crew.
     */
    staff?: boolean;
  }

  interface FastifyRequest {
    /** La partecipazione dell'utente al viaggio; `null` se passa come staff senza esserne membro. */
    tripMember: TripMember | null;
    /** Il ruolo con cui agisce: il suo nella crew, oppure coordinatore se passa come staff. */
    tripRole: TripRole;
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
    const { tripRoles: allowedRoles, staff } = request.routeOptions.config;
    const allowedAsMember = member && (!allowedRoles || allowedRoles.includes(member.role));

    if (member && allowedAsMember) {
      const { trip, ...tripMember } = member;
      request.tripMember = tripMember;
      request.tripRole = tripMember.role;
      request.trip = trip;
      return;
    }

    // Il ruolo di staff si rilegge a ogni richiesta, e solo quando la crew non basta.
    if (staff && (await isStaff(app, request.user.id))) {
      const trip = member?.trip ?? (await app.prisma.trip.findUnique({ where: { id: tripId } }));
      if (!trip) throw notFound('Trip');
      request.tripMember = member
        ? { tripId: member.tripId, userId: member.userId, role: member.role, joinedAt: member.joinedAt }
        : null;
      request.tripRole = TripRole.coordinator;
      request.trip = trip;
      request.log.info({ userId: request.user.id, tripId }, 'Staff acting on a trip');
      return;
    }

    if (!member) throw notFound('Trip');
    throw forbidden(`This action requires one of the roles: ${allowedRoles?.join(', ') ?? ''}`);
  };
}

async function isStaff(app: FastifyInstance, userId: string) {
  const user = await app.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  return user?.isAdmin === true;
}

/** Le route che organizzano il viaggio: coordinatori della crew e staff. */
export const COORDINATOR_ONLY = { tripRoles: ['coordinator'], staff: true } as const satisfies {
  tripRoles: readonly TripRole[];
  staff: boolean;
};

/** Le letture che servono anche allo staff (il viaggio, i suoi documenti). */
export const MEMBERS_AND_STAFF = { staff: true } as const;
