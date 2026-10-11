import { z } from 'zod';

import { AppEventName, AppPlatform, PerfMetric, TelemetrySource } from '../../generated/prisma/enums.js';
import { isoDateTime } from '../../lib/schemas.js';

/**
 * Cosa mandano app e pannello. Niente contenuti: nomi di schermate e di
 * chiamate, durate, istanti. I limiti tengono piccoli i lotti e impediscono di
 * usare l'endpoint come un deposito di testo libero.
 */

/** Il nome di una schermata o pagina: `TripDetail`, `viaggi/:id`. */
const Target = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\w/:{}. -]+$/, 'Unexpected characters');

export const EventInput = z
  .object({
    name: z.enum(AppEventName),
    screen: Target.optional(),
    tripId: z.uuid().optional(),
    occurredAt: isoDateTime,
  })
  .refine((event) => event.name !== 'screen_view' || event.screen, {
    path: ['screen'],
    message: 'A screen view needs the screen name',
  });

/** Valori plausibili per metrica: oltre, è un orologio impazzito, non una misura. */
const MAX_VALUE: Record<PerfMetric, number> = {
  app_start: 120_000,
  screen_ready: 120_000,
  api_latency: 120_000,
  slow_frames: 100,
  frozen_frames: 100,
  lcp: 120_000,
  inp: 60_000,
  cls: 100,
  ttfb: 120_000,
};

export const SampleInput = z
  .object({
    metric: z.enum(PerfMetric),
    target: Target.optional(),
    value: z.number().finite().min(0),
    occurredAt: isoDateTime,
  })
  .refine((sample) => sample.value <= MAX_VALUE[sample.metric], {
    path: ['value'],
    message: 'Value out of range for the metric',
  });

export const TelemetryBody = z
  .object({
    source: z.enum(TelemetrySource),
    platform: z.enum(AppPlatform),
    appVersion: z
      .string()
      .trim()
      .max(32)
      .regex(/^[\w.+-]*$/)
      .optional(),
    events: z.array(EventInput).max(50).default([]),
    samples: z.array(SampleInput).max(100).default([]),
  })
  // L'uso del pannello non è uso dell'app: lo staff manda solo prestazioni.
  .refine((body) => body.source === 'app' || body.events.length === 0, {
    path: ['events'],
    message: 'Only the app sends usage events',
  });

export const TelemetryResponse = z.object({ events: z.number().int(), samples: z.number().int() });
