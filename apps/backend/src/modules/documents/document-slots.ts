import type { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../lib/errors.js';

type Tx = Prisma.TransactionClient;

/**
 * Un documento vive in un solo slot (alloggio, attività, mezzo, polizza…).
 * Collegarlo è un "claim" atomico: `attached` passa da false a true una sola
 * volta, quindi due slot non possono contendersi lo stesso documento nemmeno
 * con richieste parallele.
 */
export async function claimDocument(tx: Tx, tripId: string, documentId: string) {
  const { count } = await tx.document.updateMany({
    where: { id: documentId, tripId, attached: false },
    data: { attached: true },
  });
  if (count === 0) {
    throw new AppError(
      409,
      'DOCUMENT_UNAVAILABLE',
      'The document does not exist in this trip or is already attached elsewhere',
    );
  }
}

/** Cancella un documento staccato dal suo slot; restituisce il file da togliere dal bucket. */
export async function releaseDocument(tx: Tx, documentId: string | null): Promise<string[]> {
  if (!documentId) return [];
  const { storagePath } = await tx.document.delete({
    where: { id: documentId },
    select: { storagePath: true },
  });
  return storagePath ? [storagePath] : [];
}

/**
 * Applica a uno slot la richiesta del client sul documento:
 * `undefined` lascia tutto com'è, `null` stacca, un id collega (e il documento
 * precedente, se c'era, viene cancellato).
 *
 * Restituisce l'id da scrivere nello slot e i file da togliere dal bucket
 * dopo il commit.
 */
export async function swapDocument(
  tx: Tx,
  tripId: string,
  current: string | null,
  next: string | null | undefined,
): Promise<{ documentId: string | null; removedPaths: string[] }> {
  if (next === undefined || next === current) return { documentId: current, removedPaths: [] };
  if (next !== null) await claimDocument(tx, tripId, next);
  return { documentId: next, removedPaths: await releaseDocument(tx, current) };
}
