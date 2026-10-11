import type { PrismaClient } from '../../lib/prisma.js';

/**
 * Strumenti comuni alle metriche del pannello: il giorno di oggi nel fuso di
 * chi guarda, la finestra di giorni e l'ultimo accesso delle persone.
 */

export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/** 'YYYY-MM-DD' di adesso in `timeZone`. */
export const todayIn = (timeZone: string, now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    now,
  );

const DAY = 86_400_000;

export const addDays = (isoDay: string, days: number) =>
  new Date(Date.parse(`${isoDay}T00:00:00.000Z`) + days * DAY).toISOString().slice(0, 10);

/** Tutti i giorni da `from` a `to` compresi: le serie non hanno buchi nei giorni senza dati. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/**
 * Un limite inferiore in UTC largo un giorno in più: la query usa l'indice su
 * `occurredAt` e poi filtra per giorno locale, qualunque sia il fuso.
 */
export const coarseFrom = (fromDay: string) => new Date(Date.parse(`${addDays(fromDay, -1)}T00:00:00.000Z`));

/** L'ultimo evento di ogni persona, per "ultimo accesso" e "mai entrato". */
export async function lastSeenByUser(prisma: PrismaClient, userIds: string[]): Promise<Map<string, Date>> {
  if (userIds.length === 0) return new Map();
  const rows = await prisma.appEvent.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds } },
    _max: { occurredAt: true },
  });
  return new Map(
    rows.flatMap((row) => (row._max.occurredAt ? [[row.userId, row._max.occurredAt] as const] : [])),
  );
}
