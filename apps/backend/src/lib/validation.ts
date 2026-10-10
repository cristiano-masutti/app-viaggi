import type { z } from 'zod';

import { AppError } from './errors.js';

/**
 * Validazione a mano, per i dati che non passano dallo `schema` della route
 * (campi multipart, body alternativi). L'errore ha lo stesso formato di quello
 * prodotto dalla validazione automatica.
 */
export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown, context: string): z.output<T> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  throw new AppError(400, 'VALIDATION_ERROR', `Invalid request ${context}`, {
    details: result.error.issues.map((issue) => ({
      path: `/${issue.path.join('/')}`,
      message: issue.message,
    })),
  });
}
