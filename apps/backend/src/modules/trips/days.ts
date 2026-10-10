import { AppError, notFound } from '../../lib/errors.js';

/**
 * Un viaggio non ha orari, solo giorni: G1 è `startDate`, Gn è `endDate`.
 * Alloggi, attività e ricordi si agganciano all'indice del giorno (1-based),
 * quindi spostare le date sposta tutto il programma insieme.
 */
const MS_PER_DAY = 86_400_000;

/** Tetto di sicurezza: oltre, è un errore di battitura, non un viaggio. */
export const MAX_TRIP_DAYS = 366;

/** Giorni inclusivi: dal 14 al 23 settembre = 10 giorni. */
export const countDays = (startDate: Date, endDate: Date) =>
  Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

export const dayDate = (startDate: Date, dayIndex: number) =>
  new Date(startDate.getTime() + (dayIndex - 1) * MS_PER_DAY);

export function assertDayInTrip(trip: { startDate: Date; endDate: Date }, dayIndex: number) {
  if (dayIndex < 1 || dayIndex > countDays(trip.startDate, trip.endDate)) throw notFound('Day');
}

/** Le stesse regole del body di creazione, per quando le date arrivano da una modifica parziale. */
export function assertValidDates(startDate: Date, endDate: Date) {
  const message =
    endDate < startDate
      ? 'endDate must be on or after startDate'
      : countDays(startDate, endDate) > MAX_TRIP_DAYS
        ? `A trip lasts at most ${MAX_TRIP_DAYS} days`
        : null;

  if (message) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid request body', {
      details: [{ path: '/endDate', message }],
    });
  }
}
