import type { Middleware } from 'openapi-fetch';

import type { Telemetry } from './Telemetry';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** `/api/trips/2f1c…/documents` → `/api/trips/{id}/documents`: si raggruppa per chiamata, non per viaggio. */
export const templatePath = (path: string) => path.split('?')[0]!.replace(UUID, '{id}');

/**
 * Quanto ci mette ogni chiamata, vista dal telefono (rete compresa): è quella
 * che l'utente sente. Il nome è il percorso della specifica, senza id.
 */
export function apiTimingMiddleware(
  telemetry: Telemetry,
  now: () => number = () => performance.now(),
): Middleware {
  const started = new Map<string, number>();
  return {
    onRequest({ id }) {
      started.set(id, now());
      return undefined;
    },
    onResponse({ id, request, schemaPath }) {
      const start = started.get(id);
      started.delete(id);
      // L'invio delle metriche non è una chiamata che l'utente aspetta.
      if (schemaPath === '/api/telemetry') return undefined;
      if (start !== undefined)
        telemetry.sample('api_latency', now() - start, `${request.method} ${schemaPath}`);
      return undefined;
    },
    onError({ id }) {
      started.delete(id);
      return undefined;
    },
  };
}
