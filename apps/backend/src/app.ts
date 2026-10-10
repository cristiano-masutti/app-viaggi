import { randomUUID } from 'node:crypto';

import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';

import type { AppConfig } from './config/env.js';
import { registerErrorHandling } from './lib/errors.js';
import type { PrismaClient } from './lib/prisma.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { tripRoutes } from './modules/trips/trips.routes.js';
import { uploadRoutes } from './modules/uploads/uploads.routes.js';
import type { ObjectStorage } from './storage/storage.js';

/**
 * Tutto ciò che l'app usa del mondo esterno. Il server costruisce le versioni
 * vere, i test passano un database di test e uno storage in memoria: le route
 * non sanno quale dei due stanno usando.
 */
export interface AppDeps {
  config: AppConfig;
  prisma: PrismaClient;
  storage: ObjectStorage;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    prisma: PrismaClient;
    storage: ObjectStorage;
  }
}

export interface BuildAppOptions {
  logger?: FastifyServerOptions['logger'];
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

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.decorate('config', deps.config);
  app.decorate('prisma', deps.prisma);
  app.decorate('storage', deps.storage);

  registerErrorHandling(app);

  await app.register(cors, { origin: deps.config.CORS_ORIGIN });
  await app.register(multipart, {
    limits: { fileSize: deps.config.UPLOAD_MAX_BYTES, files: 1 },
  });

  await app.register(healthRoutes);
  await app.register(tripRoutes, { prefix: '/api' });
  await app.register(uploadRoutes, { prefix: '/api' });

  return app;
}
