import type { IncomingMessage, ServerResponse } from 'node:http';

import { createProductionApp } from './bootstrap.js';

type App = Awaited<ReturnType<typeof createProductionApp>>['app'];

/**
 * Il backend come Vercel Function: `api/index.js` la esporta e `vercel.json`
 * le manda ogni richiesta. L'app nasce alla prima richiesta e resta viva con
 * l'istanza (connessioni a Postgres e chiavi JWKS in cache comprese), come un
 * server; Fastify riceve la richiesta così com'è, senza adattatori.
 */
let ready: Promise<App> | undefined;

function getApp(): Promise<App> {
  ready ??= createProductionApp(process.env)
    .then(async ({ app }) => {
      await app.ready();
      return app;
    })
    .catch((error: unknown) => {
      // Un avvio fallito (es. variabile mancante) si ritenta alla richiesta dopo.
      ready = undefined;
      throw error;
    });
  return ready;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  app.server.emit('request', req, res);
}
