import swagger from '@fastify/swagger';
import type { FastifyInstance } from 'fastify';
import { jsonSchemaTransform, jsonSchemaTransformObject } from 'fastify-type-provider-zod';

/**
 * La specifica OpenAPI nasce dagli stessi schemi zod che validano le richieste
 * e serializzano le risposte: non può raccontare un'API diversa da quella che
 * gira. `npm run openapi` la scrive in `openapi.json`, da cui il mobile genera
 * i suoi tipi; un test fallisce se il file non è aggiornato.
 *
 * Va registrata prima delle route: le raccoglie mentre vengono dichiarate.
 */
export async function registerOpenApi(app: FastifyInstance) {
  await app.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Vibemakers Travel API',
        version: '1.0.0',
        description:
          'Tutte le route sotto /api richiedono un access token di Supabase Auth. ' +
          'Errori: { "error": { "code", "message", "details"? } }.',
      },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      },
      security: [{ bearerAuth: [] }],
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
}
