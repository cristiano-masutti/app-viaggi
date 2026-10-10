import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';

import { forbidden } from '../../lib/errors.js';

/**
 * Registra le route del pannello di controllo sotto `/admin`. Come per i
 * viaggi è "deny by default": l'hook vale per ogni route registrata qui dentro,
 * presente e futura, e gira prima che il body venga letto.
 *
 * Il ruolo si rilegge dal database a ogni richiesta, non dal token: revocarlo
 * ha effetto subito, senza aspettare che il token scada.
 */
export async function adminScope(app: FastifyInstance, register: (scope: FastifyInstance) => Promise<void>) {
  await app.register(
    async (scope) => {
      scope.addHook('onRequest', requireAdmin(scope));
      // Dati personali: né il browser né un proxy devono tenerne copia.
      scope.addHook('onSend', async (_request, reply) => {
        reply.header('cache-control', 'no-store');
      });
      await register(scope);
    },
    { prefix: '/admin' },
  );
}

function requireAdmin(app: FastifyInstance): onRequestAsyncHookHandler {
  return async (request) => {
    const user = await app.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) throw forbidden('This area is reserved to the staff');
  };
}
