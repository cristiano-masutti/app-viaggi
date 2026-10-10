import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyRequest, type FastifyServerOptions, type RouteOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import { createAuthenticateHook } from './auth/authenticate.js';
import type { TokenVerifier } from './auth/token-verifier.js';
import type { AppConfig } from './config/env.js';
import { registerErrorHandling } from './lib/errors.js';
import type { PrismaClient } from './lib/prisma.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { inviteRoutes } from './modules/crew/invites.routes.js';
import { meRoutes } from './modules/me/me.routes.js';
import { tripRoutes } from './modules/trips/trips.routes.js';
import { registerOpenApi } from './openapi.js';
import type { ObjectStorage } from './storage/storage.js';

/**
 * Tutto ciò che l'app usa del mondo esterno. Il server costruisce le versioni
 * vere, i test passano un database di test, uno storage in memoria e chiavi di
 * firma generate al volo: le route non sanno quale dei due stanno usando.
 */
export interface AppDeps {
  config: AppConfig;
  prisma: PrismaClient;
  storage: ObjectStorage;
  tokenVerifier: TokenVerifier;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    prisma: PrismaClient;
    storage: ObjectStorage;
    tokenVerifier: TokenVerifier;
  }
}

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger'];
  /** Chiamata per ogni route registrata: i test la usano per elencare tutte le route. */
  onRoute?: (route: RouteOptions) => void;
}

export async function buildApp(deps: AppDeps, options: BuildAppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? {
      level: deps.config.LOG_LEVEL,
      redact: ['req.headers.authorization', 'req.headers.cookie'],
    },
    // Un id per richiesta, ripreso dal proxy se c'è: lega fra loro le righe di log.
    requestIdHeader: 'x-request-id',
    genReqId: () => randomUUID(),
  });

  // Il client può citare l'id quando segnala un errore: si ritrova la richiesta nei log.
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  if (options.onRoute) app.addHook('onRoute', options.onRoute);

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('config', deps.config);
  app.decorate('prisma', deps.prisma);
  app.decorate('storage', deps.storage);
  app.decorate('tokenVerifier', deps.tokenVerifier);
  // Valorizzati dagli hook di autenticazione e di accesso al viaggio prima di
  // qualunque handler che li legga; dichiararli qui tiene stabile la forma
  // dell'oggetto request (raccomandazione di Fastify).
  app.decorateRequest('user', null as unknown as FastifyRequest['user']);
  app.decorateRequest('tripMember', null as unknown as FastifyRequest['tripMember']);
  app.decorateRequest('trip', null as unknown as FastifyRequest['trip']);

  registerErrorHandling(app);

  await app.register(cors, {
    origin: deps.config.CORS_ORIGIN,
    // Il default del plugin ammette solo i metodi "semplici" (GET, HEAD, POST):
    // dal browser ogni modifica (PUT, PATCH, DELETE) verrebbe bloccata.
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(multipart, {
    limits: { fileSize: deps.config.UPLOAD_MAX_BYTES, files: 1 },
  });

  await registerOpenApi(app);

  // Pubbliche: le sonde dell'orchestratore non hanno un utente.
  await app.register(healthRoutes);

  // Tutto il resto sta sotto /api ed è protetto per costruzione: l'hook vale
  // per ogni route registrata qui dentro, presente e futura.
  await app.register(
    async (api) => {
      api.addHook('onRequest', createAuthenticateHook(api));
      await api.register(meRoutes);
      await api.register(tripRoutes);
      await api.register(inviteRoutes);
    },
    { prefix: '/api' },
  );

  return app;
}
