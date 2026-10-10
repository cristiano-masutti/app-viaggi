import type { FastifyError, FastifyInstance } from 'fastify';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';

import { StorageError } from '../storage/storage.js';

/**
 * Formato unico degli errori dell'API:
 *
 *   { "error": { "code": "NOT_FOUND", "message": "Trip not found", "details": … } }
 *
 * `code` è stabile e pensato per il client (mai un testo da mostrare così com'è),
 * `message` è per chi legge i log, `details` compare solo dove aiuta a correggere
 * la richiesta (es. i campi non validi).
 */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFound = (resource: string) => new AppError(404, 'NOT_FOUND', `${resource} not found`);

export const badRequest = (code: string, message: string, details?: unknown) =>
  new AppError(400, code, message, details);

const errorBody = (code: string, message: string, details?: unknown): ErrorBody => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

/** Codici Fastify (`FST_ERR_CTP_INVALID_MEDIA_TYPE`…) → codici dell'API, leggibili dal client. */
const clientErrorCode = (error: FastifyError): string => {
  switch (error.statusCode) {
    case 400:
      return 'BAD_REQUEST';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 415:
      return 'UNSUPPORTED_MEDIA_TYPE';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'CLIENT_ERROR';
  }
};

export function registerErrorHandling(app: FastifyInstance) {
  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send(errorBody('ROUTE_NOT_FOUND', `Route ${request.method} ${request.url.split('?')[0]} not found`)),
  );

  app.setErrorHandler<FastifyError | AppError | StorageError>((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, error.message);
      return reply.status(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }

    if (error instanceof StorageError) {
      request.log.error({ err: error }, error.message);
      return reply.status(502).send(errorBody('STORAGE_UNAVAILABLE', 'File storage is unavailable'));
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send(
        errorBody(
          'VALIDATION_ERROR',
          `Invalid request ${error.validationContext ?? 'payload'}`,
          error.validation.map((issue) => ({
            path: issue.instancePath,
            message: issue.message,
          })),
        ),
      );
    }

    // Errori del client già classificati da Fastify o dai suoi plugin
    // (JSON malformato, file troppo grande, content-type sconosciuto…).
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send(errorBody(clientErrorCode(error), error.message));
    }

    // Tutto il resto è un nostro bug o un guasto a valle: si logga per intero,
    // al client non arriva nessun dettaglio interno.
    request.log.error({ err: error }, 'Unhandled error');
    return reply.status(500).send(errorBody('INTERNAL_ERROR', 'Internal server error'));
  });
}
