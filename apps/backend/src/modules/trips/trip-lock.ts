import type { Prisma, Trip } from '../../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;

/**
 * Blocca la riga del viaggio fino alla fine della transazione e la rilegge.
 *
 * Le regole che coinvolgono più righe (i giorni esistono finché le date li
 * includono, i posti occupati non superano la capienza) si possono violare
 * solo con scritture contemporanee: chi le tocca passa da qui.
 *
 * - `update`: chi cambia le regole (date, capienza) o occupa un posto
 *   (ingresso col link, posti riservati, uscita dei coordinatori).
 * - `share`: chi aggiunge contenuti legati a un giorno (alloggi, attività,
 *   ricordi). Queste scritture non si bloccano fra loro, ma aspettano chi sta
 *   cambiando le date, e chi cambia le date aspetta loro.
 */
export async function lockTrip(tx: Tx, tripId: string, mode: 'update' | 'share' = 'update'): Promise<Trip> {
  if (mode === 'update') await tx.$queryRaw`SELECT 1 FROM "Trip" WHERE "id" = ${tripId}::uuid FOR UPDATE`;
  else await tx.$queryRaw`SELECT 1 FROM "Trip" WHERE "id" = ${tripId}::uuid FOR SHARE`;
  return tx.trip.findUniqueOrThrow({ where: { id: tripId } });
}

/** Posti occupati: i membri più i posti riservati a chi non è ancora entrato. */
export async function seatsTaken(tx: Tx, tripId: string) {
  const [members, pendingInvitations] = await Promise.all([
    tx.tripMember.count({ where: { tripId } }),
    tx.tripInvitation.count({ where: { tripId, acceptedAt: null } }),
  ]);
  return { members, pendingInvitations, total: members + pendingInvitations };
}
