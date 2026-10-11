import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { forbidden } from '../../lib/errors.js';
import { TelemetryBody, TelemetryResponse } from './telemetry.schemas.js';

const MINUTE = 60_000;
const DAY = 86_400_000;
/** Un telefono rimasto offline in viaggio può mandare eventi vecchi di settimane, non di mesi. */
const MAX_AGE_MS = 30 * DAY;
const MAX_SKEW_MS = 5 * MINUTE;

/** L'orologio del telefono può sbagliare: un istante implausibile diventa "adesso". */
export function plausibleInstant(occurredAt: Date, now = new Date()): Date {
  const age = now.getTime() - occurredAt.getTime();
  return age > MAX_AGE_MS || age < -MAX_SKEW_MS ? now : occurredAt;
}

/**
 * Le metriche dell'app e del pannello, a lotti. Gli eventi d'uso sono legati a
 * chi li manda; un evento su un viaggio conta per quel viaggio solo se chi lo
 * manda è nella crew, così nessuno può gonfiare le metriche di un viaggio altrui.
 * I campioni di prestazioni restano anonimi; quelli del pannello li manda solo lo staff.
 */
export const telemetryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/telemetry',
    { schema: { body: TelemetryBody, response: { 202: TelemetryResponse } } },
    async (request, reply) => {
      const { source, platform, appVersion, events, samples } = request.body;
      const userId = request.user.id;
      const now = new Date();

      // Le misure del pannello finiscono nella dashboard dello staff: le manda solo lo staff.
      // Il ruolo si rilegge dal database, come per /api/admin.
      if (source === 'panel') {
        const sender = await app.prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
        if (!sender?.isAdmin) throw forbidden('Only the staff sends panel measurements');
      }

      const tripIds = [...new Set(events.flatMap((event) => (event.tripId ? [event.tripId] : [])))];
      const memberOf = new Set(
        tripIds.length === 0
          ? []
          : (
              await app.prisma.tripMember.findMany({
                where: { userId, tripId: { in: tripIds } },
                select: { tripId: true },
              })
            ).map((member) => member.tripId),
      );

      await app.prisma.$transaction([
        app.prisma.appEvent.createMany({
          data: events.map((event) => ({
            userId,
            tripId: event.tripId && memberOf.has(event.tripId) ? event.tripId : null,
            name: event.name,
            screen: event.screen ?? null,
            platform,
            appVersion: appVersion ?? null,
            occurredAt: plausibleInstant(event.occurredAt, now),
          })),
        }),
        app.prisma.perfSample.createMany({
          data: samples.map((sample) => ({
            source,
            platform,
            appVersion: appVersion ?? null,
            metric: sample.metric,
            target: sample.target ?? null,
            value: sample.value,
            occurredAt: plausibleInstant(sample.occurredAt, now),
          })),
        }),
      ]);

      return reply.status(202).send({ events: events.length, samples: samples.length });
    },
  );
};
