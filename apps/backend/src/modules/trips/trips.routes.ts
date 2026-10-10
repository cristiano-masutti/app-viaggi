import type { FastifyPluginAsyncZod, ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { assetRoutes } from '../assets/assets.routes.js';
import { TripParams, tripScope } from './trip-access.js';
import { CreateTripBody, TripDto } from './trips.schemas.js';

const withAssetCount = { _count: { select: { assets: true } } } as const;

export const tripRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Solo i viaggi di cui l'utente fa parte, dal più recente. */
  app.get(
    '/trips',
    { schema: { response: { 200: z.object({ trips: z.array(TripDto) }) } } },
    async (request) => {
      const memberships = await app.prisma.tripMember.findMany({
        where: { userId: request.user.id },
        include: { trip: { include: withAssetCount } },
        orderBy: { trip: { createdAt: 'desc' } },
      });

      return {
        trips: memberships.map(({ role, trip: { _count, ...trip } }) => ({
          ...trip,
          myRole: role,
          assetCount: _count.assets,
        })),
      };
    },
  );

  /** Chi crea il viaggio ne diventa il coordinatore, nella stessa transazione. */
  app.post(
    '/trips',
    { schema: { body: CreateTripBody, response: { 201: z.object({ trip: TripDto }) } } },
    async (request, reply) => {
      const trip = await app.prisma.trip.create({
        data: {
          ...request.body,
          members: { create: { userId: request.user.id, role: TripRole.COORDINATOR } },
        },
      });

      return reply.status(201).send({ trip: { ...trip, myRole: TripRole.COORDINATOR, assetCount: 0 } });
    },
  );

  await tripScope(app, async (scope) => {
    const trips = scope.withTypeProvider<ZodTypeProvider>();

    trips.get(
      '/trips/:tripId',
      { schema: { params: TripParams, response: { 200: z.object({ trip: TripDto }) } } },
      async (request) => {
        const { _count, ...trip } = await app.prisma.trip.findUniqueOrThrow({
          where: { id: request.params.tripId },
          include: withAssetCount,
        });

        return { trip: { ...trip, myRole: request.tripMember.role, assetCount: _count.assets } };
      },
    );

    await scope.register(assetRoutes);
  });
};
