import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { CreateTripBody, TripDto } from './trips.schemas.js';

export const tripRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/trips', { schema: { response: { 200: z.object({ trips: z.array(TripDto) }) } } }, async () => {
    const trips = await app.prisma.trip.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { assets: true } } },
    });

    return {
      trips: trips.map(({ _count, ...trip }) => ({ ...trip, assetCount: _count.assets })),
    };
  });

  app.post(
    '/trips',
    { schema: { body: CreateTripBody, response: { 201: z.object({ trip: TripDto }) } } },
    async (request, reply) => {
      const trip = await app.prisma.trip.create({ data: request.body });
      return reply.status(201).send({ trip: { ...trip, assetCount: 0 } });
    },
  );
};
