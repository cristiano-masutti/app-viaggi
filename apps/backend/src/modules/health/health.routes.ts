import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

const HealthResponse = z.object({ status: z.literal('ok') });

const ReadyResponse = z.object({
  status: z.enum(['ok', 'unavailable']),
  checks: z.object({ database: z.enum(['ok', 'error']) }),
});

/**
 * Due sonde distinte, come le vuole qualunque orchestratore:
 *
 * - `/health` (liveness) risponde finché il processo è vivo. Non tocca il
 *   database: se Postgres ha un problema, riavviare l'API non lo risolve.
 * - `/health/ready` (readiness) dice se l'istanza può servire traffico. Con il
 *   database giù risponde 503 e il load balancer la toglie dal giro.
 */
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/health', { schema: { response: { 200: HealthResponse } } }, async () => ({
    status: 'ok' as const,
  }));

  app.get(
    '/health/ready',
    { schema: { response: { 200: ReadyResponse, 503: ReadyResponse } } },
    async (request, reply) => {
      try {
        await app.prisma.$queryRaw`SELECT 1`;
        return { status: 'ok' as const, checks: { database: 'ok' as const } };
      } catch (error) {
        request.log.error({ err: error }, 'Readiness check failed: database unreachable');
        return reply.status(503).send({ status: 'unavailable', checks: { database: 'error' } });
      }
    },
  );
};
