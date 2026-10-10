import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { AppError, notFound } from '../../lib/errors.js';
import { countDays } from '../trips/days.js';
import { seatsTaken } from '../trips/trip-lock.js';
import { InvitePreviewDto, InviteParams } from './crew.schemas.js';

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

        const existing = await tx.tripMember.findUnique({
          where: { tripId_userId: { tripId: trip.id, userId: user.id } },
        });
        if (existing) return { tripId: trip.id, joined: false };

        // Il posto riservato a questa persona, se il coordinatore l'aveva invitata
        // per email: entrando lo occupa, quindi la capienza non cambia.
        const invitation = user.email
          ? await tx.tripInvitation.findFirst({
              where: { tripId: trip.id, email: user.email.toLowerCase(), acceptedAt: null },
              orderBy: { createdAt: 'asc' },
            })
          : null;

        if (!invitation && trip.crewCapacity !== null) {
          // Chi non era atteso trova posto solo fra quelli non riservati.
          const seats = await seatsTaken(tx, trip.id);
          if (seats.total >= trip.crewCapacity) {
            throw new AppError(409, 'TRIP_FULL', 'All the places in this trip are taken');
          }
        }

        await tx.tripMember.create({ data: { tripId: trip.id, userId: user.id, role: TripRole.traveller } });
        if (invitation) {
          await tx.tripInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
        }

        return { tripId: trip.id, joined: true };
      });
    },
  );
};
