import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { isoDateTime } from '../../lib/schemas.js';

const MeDto = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  createdAt: isoDateTime,
});

export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  /** L'utente del token: il primo endpoint che il client chiama dopo il login. */
  app.get('/me', { schema: { response: { 200: z.object({ user: MeDto }) } } }, async (request) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.user.id } });
    return { user };
  });
};
