import type { PrismaClient } from '../src/lib/prisma.js';

/** Quanti giorni tenere eventi e campioni, se non si dice altro. */
export const DEFAULT_RETENTION_DAYS = 180;

/**
 * Cancella eventi d'uso e campioni di prestazioni più vecchi di `days` giorni:
 * per le metriche bastano gli ultimi mesi, e un dato che non serve più non si tiene.
 */
export async function pruneTelemetry(prisma: PrismaClient, days = DEFAULT_RETENTION_DAYS, now = new Date()) {
  if (!Number.isInteger(days) || days < 7) throw new Error('Tieni almeno 7 giorni di metriche.');
  const before = new Date(now.getTime() - days * 86_400_000);
  const [events, samples] = await prisma.$transaction([
    prisma.appEvent.deleteMany({ where: { occurredAt: { lt: before } } }),
    prisma.perfSample.deleteMany({ where: { occurredAt: { lt: before } } }),
  ]);
  return { events: events.count, samples: samples.count, before };
}
