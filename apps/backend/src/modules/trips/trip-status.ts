import type { Prisma } from '../../generated/prisma/client.js';

/**
 * In corso, futuro o passato rispetto a `today`: le stesse regole del mobile
 * (`tripTimeline`). Un viaggio è in corso dal primo all'ultimo giorno compresi.
 *
 * `today` è una data senza orario (mezzanotte UTC, come `@db.Date`). Il server
 * non sa in che fuso è chi guarda: il client la manda, e senza si usa la data UTC.
 */
export type TripStatus = 'ongoing' | 'upcoming' | 'past';

export const TRIP_STATUSES = ['ongoing', 'upcoming', 'past'] as const satisfies readonly TripStatus[];

export function utcToday(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function tripStatus(trip: { startDate: Date; endDate: Date }, today: Date): TripStatus {
  if (trip.endDate < today) return 'past';
  if (trip.startDate > today) return 'upcoming';
  return 'ongoing';
}

/** Lo stesso criterio come filtro per il database. */
export function tripStatusWhere(status: TripStatus, today: Date): Prisma.TripWhereInput {
  switch (status) {
    case 'past':
      return { endDate: { lt: today } };
    case 'upcoming':
      return { startDate: { gt: today } };
    case 'ongoing':
      return { startDate: { lte: today }, endDate: { gte: today } };
  }
}
