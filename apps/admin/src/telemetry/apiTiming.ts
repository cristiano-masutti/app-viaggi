import type { Middleware } from 'openapi-fetch';

import type { PanelTelemetry } from './PanelTelemetry';

/**
 * Quanto ci mette ogni chiamata vista dal browser, rete compresa. Il nome è
 * il percorso della specifica (`GET /api/admin/trips/{tripId}`), senza id.
 */
export function apiTimingMiddleware(
  telemetry: PanelTelemetry,
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
      // L'invio delle metriche non è una chiamata che lo staff aspetta.
      if (schemaPath === '/api/telemetry' || start === undefined) return undefined;
      telemetry.sample('api_latency', now() - start, `${request.method} ${schemaPath}`);
      return undefined;
    },
    onError({ id }) {
      started.delete(id);
      return undefined;
    },
  };
}
