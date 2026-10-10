import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { notFound } from '../../lib/errors.js';
import { countDays } from '../trips/days.js';
import { InvitePreviewDto, InviteParams } from './crew.schemas.js';
import { addMember } from './membership.js';

/**
 * Il link `vibemakers.travel/join/<code>`. Queste route stanno fuori dallo
 * scope del viaggio: chi le chiama non ne fa ancora parte. Il codice è il
 * segreto; chi non lo conosce riceve 404 come per un codice inesistente.
 */
export const inviteRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Cosa mostrare prima di entrare: "Entra in Islanda On The Road, 14–23 Settembre". */
  app.get(
    '/invites/:code',
    { schema: { params: InviteParams, response: { 200: InvitePreviewDto } } },
    async (request) => {
      const trip = await app.prisma.trip.findUnique({
        where: { inviteCode: request.params.code },
        include: {
          members: {
            where: { role: TripRole.coordinator },
            select: { user: { select: { firstName: true, lastName: true } } },
          },
          _count: { select: { members: true } },
        },
      });
      if (!trip) throw notFound('Invite');

      const alreadyMember = await app.prisma.tripMember.count({
        where: { tripId: trip.id, userId: request.user.id },
      });

      return {
        trip: {
          ...trip,
          totalDays: countDays(trip.startDate, trip.endDate),
          crewCount: trip._count.members,
          coordinators: trip.members.map(({ user }) => user),
        },
        alreadyMember: alreadyMember > 0,
      };
    },
  );

  /**
   * Entra nel viaggio come viaggiatore. Ripetere la chiamata non fa danni.
   * La riga del viaggio resta bloccata durante il controllo dei posti: due
   * persone che entrano insieme sull'ultimo posto non sforano la capienza.
   */
  app.post(
    '/invites/:code/accept',
    {
      schema: {
        params: InviteParams,
        response: { 200: z.object({ tripId: z.uuid(), joined: z.boolean() }) },
      },
    },
    async (request) => {
      const user = request.user;

      return app.prisma.$transaction(async (tx) => {
        const [trip] = await tx.$queryRaw<Array<{ id: string; crewCapacity: number | null }>>`
          SELECT "id", "crewCapacity" FROM "Trip" WHERE "inviteCode" = ${request.params.code} FOR UPDATE
        `;
        if (!trip) throw notFound('Invite');

        const outcome = await addMember(tx, trip, user, TripRole.traveller);
        return { tripId: trip.id, joined: outcome === 'joined' };
      });
    },
  );
};
