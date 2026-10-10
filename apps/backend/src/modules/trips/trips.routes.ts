import type { FastifyPluginAsyncZod, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { AppError } from '../../lib/errors.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { removeStoredFiles } from '../../storage/cleanup.js';
import { crewRoutes } from '../crew/crew.routes.js';
import { documentRoutes } from '../documents/documents.routes.js';
import { itineraryRoutes } from '../itinerary/itinerary.routes.js';
import { logisticsRoutes } from '../logistics/logistics.routes.js';
import { memoryRoutes } from '../memories/memories.routes.js';
import { assertValidDates, countDays } from './days.js';
import { generateInviteCode } from './invite-code.js';
import { COORDINATOR_ONLY, TripParams, tripScope } from './trip-access.js';
import { lockTrip, seatsTaken } from './trip-lock.js';
import { loadTripDetail, visibleMediaWhere } from './trip-detail.js';
import { CreateTripBody, TripDetailResponse, TripSummaryDto, UpdateTripBody } from './trips.schemas.js';

export const tripRoutes: FastifyPluginAsyncZod = async (app) => {
  /** I viaggi di cui l'utente fa parte, dal più recente. */
  app.get(
    '/trips',
    { schema: { response: { 200: z.object({ trips: z.array(TripSummaryDto) }) } } },
    async (request) => {
      const userId = request.user.id;
      const memberships = await app.prisma.tripMember.findMany({
        where: { userId },
        include: {
          trip: {
            include: {
              _count: { select: { members: true, memories: { where: visibleMediaWhere(userId) } } },
            },
          },
        },
        orderBy: [{ trip: { startDate: 'desc' } }, { trip: { createdAt: 'desc' } }, { tripId: 'asc' }],
      });

      return {
        trips: memberships.map(({ role, trip: { _count, ...trip } }) => ({
          ...trip,
          totalDays: countDays(trip.startDate, trip.endDate),
          myRole: role,
          crewCount: _count.members,
          mediaCount: _count.memories,
        })),
      };
    },
  );

  /** Chi crea il viaggio ne diventa il coordinatore, nella stessa transazione. */
  app.post(
    '/trips',
    { schema: { body: CreateTripBody, response: { 201: TripDetailResponse } } },
    async (request, reply) => {
      const { invitees, emergencies, ...trip } = request.body;
      const userId = request.user.id;

      const created = await app.prisma.trip.create({
        data: {
          ...trip,
          inviteCode: generateInviteCode(trip.title),
          members: { create: { userId, role: TripRole.coordinator } },
          invitations: { create: invitees.map((invitee) => ({ ...invitee, invitedById: userId })) },
          emergencies: { create: emergencies.map((contact, position) => ({ ...contact, position })) },
        },
      });

      const detail = await loadTripDetail(app.prisma, created.id, userId, TripRole.coordinator);
      return reply.status(201).send({ trip: detail });
    },
  );

  await tripScope(app, async (scope) => {
    const trips = scope.withTypeProvider<ZodTypeProvider>();

    trips.get(
      '/trips/:tripId',
      { schema: { params: TripParams, response: { 200: TripDetailResponse } } },
      async (request) => ({
        trip: await loadTripDetail(app.prisma, request.trip.id, request.user.id, request.tripMember.role),
      }),
    );

    /**
     * Cambiare le date sposta l'intero programma: il contenuto resta legato al
     * numero del giorno. Accorciare il viaggio non può però far sparire giorni
     * che hanno già alloggi, attività o ricordi.
     */
    trips.patch(
      '/trips/:tripId',
      {
        config: COORDINATOR_ONLY,
        schema: { params: TripParams, body: UpdateTripBody, response: { 200: TripDetailResponse } },
      },
      async (request) => {
        const tripId = request.trip.id;

        await app.prisma.$transaction(async (tx) => {
          // Sotto lock: nessuno aggiunge contenuti o entra mentre le regole cambiano.
          const trip = await lockTrip(tx, tripId);
          const startDate = request.body.startDate ?? trip.startDate;
          const endDate = request.body.endDate ?? trip.endDate;
          assertValidDates(startDate, endDate);

          const lastDayWithContent = await lastUsedDay(tx, tripId);
          if (lastDayWithContent > countDays(startDate, endDate)) {
            throw new AppError(409, 'DAYS_HAVE_CONTENT', `Day ${lastDayWithContent} still has content`, {
              details: { lastDayWithContent },
            });
          }

          const { crewCapacity } = request.body;
          if (crewCapacity) {
            const seats = await seatsTaken(tx, tripId);
            if (crewCapacity < seats.total) {
              throw new AppError(
                409,
                'CAPACITY_BELOW_CREW',
                `The trip already has ${seats.total} places taken`,
                {
                  details: { crewCount: seats.members, pendingInvitations: seats.pendingInvitations },
                },
              );
            }
          }

          await tx.trip.update({ where: { id: tripId }, data: request.body });
        });

        return {
          trip: await loadTripDetail(app.prisma, tripId, request.user.id, request.tripMember.role),
        };
      },
    );

    /** Cancella il viaggio per tutti, con ogni documento e ricordo caricato. */
    trips.delete(
      '/trips/:tripId',
      { config: COORDINATOR_ONLY, schema: { params: TripParams } },
      async (request, reply) => {
        const tripId = request.trip.id;
        const [documents, memories] = await Promise.all([
          app.prisma.document.findMany({ where: { tripId }, select: { storagePath: true } }),
          app.prisma.memory.findMany({ where: { tripId }, select: { storagePath: true } }),
        ]);

        await app.prisma.trip.delete({ where: { id: tripId } });
        await removeStoredFiles(app.storage, request.log, [
          ...documents.map((document) => document.storagePath),
          ...memories.map((memory) => memory.storagePath),
        ]);
        return reply.status(204).send();
      },
    );

    await scope.register(crewRoutes);
    await scope.register(documentRoutes);
    await scope.register(itineraryRoutes);
    await scope.register(logisticsRoutes);
    await scope.register(memoryRoutes);
  });
};

/** L'ultimo giorno a cui è agganciato qualcosa (0 se il programma è vuoto). */
async function lastUsedDay(prisma: Prisma.TransactionClient, tripId: string) {
  const where = { tripId };
  const [stay, activity, memory] = await Promise.all([
    prisma.stay.aggregate({ where, _max: { dayIndex: true } }),
    prisma.activity.aggregate({ where, _max: { dayIndex: true } }),
    prisma.memory.aggregate({ where, _max: { dayIndex: true } }),
  ]);
  return Math.max(stay._max.dayIndex ?? 0, activity._max.dayIndex ?? 0, memory._max.dayIndex ?? 0);
}
