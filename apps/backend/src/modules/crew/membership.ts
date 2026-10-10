import type { Prisma } from '../../generated/prisma/client.js';
import { TripRole } from '../../generated/prisma/enums.js';
import { AppError } from '../../lib/errors.js';
import { lockTrip, seatsTaken } from '../trips/trip-lock.js';

type Tx = Prisma.TransactionClient;

/**
 * Le regole della crew, condivise da chi entra col link, dal coordinatore e
 * dal pannello di controllo: chi cambia la crew passa da qui, sotto il lock
 * del viaggio.
 */

const lastCoordinator = () =>
  new AppError(409, 'LAST_COORDINATOR', 'A trip always needs a coordinator: promote someone else first');

/**
 * Un viaggio non resta mai senza coordinatore. Il controllo blocca la riga del
 * viaggio (FOR UPDATE), così due coordinatori che escono insieme non possono
 * lasciarlo vuoto passando entrambi il conteggio.
 */
export async function assertNotLastCoordinator(tx: Tx, tripId: string, userId: string) {
  await lockTrip(tx, tripId);
  const coordinators = await tx.tripMember.findMany({
    where: { tripId, role: TripRole.coordinator },
    select: { userId: true },
  });
  if (coordinators.length === 1 && coordinators[0]?.userId === userId) throw lastCoordinator();
}

/**
 * Fa entrare una persona nel viaggio. Va chiamata con la riga del viaggio già
 * bloccata (FOR UPDATE): due ingressi contemporanei sull'ultimo posto non
 * sforano la capienza.
 *
 * Se per l'email di questa persona c'era un posto riservato, entrando lo
 * occupa e la capienza non cambia; chi non era atteso trova posto solo fra
 * quelli non riservati.
 */
export async function addMember(
  tx: Tx,
  trip: { id: string; crewCapacity: number | null },
  user: { id: string; email: string | null },
  role: TripRole,
): Promise<'joined' | 'already-member'> {
  const existing = await tx.tripMember.findUnique({
    where: { tripId_userId: { tripId: trip.id, userId: user.id } },
  });
  if (existing) return 'already-member';

  const invitation = user.email
    ? await tx.tripInvitation.findFirst({
        where: { tripId: trip.id, email: user.email.toLowerCase(), acceptedAt: null },
        orderBy: { createdAt: 'asc' },
      })
    : null;

  if (!invitation && trip.crewCapacity !== null) {
    const seats = await seatsTaken(tx, trip.id);
    if (seats.total >= trip.crewCapacity) {
      throw new AppError(409, 'TRIP_FULL', 'All the places in this trip are taken');
    }
  }

  await tx.tripMember.create({ data: { tripId: trip.id, userId: user.id, role } });
  if (invitation) {
    await tx.tripInvitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
  }
  return 'joined';
}
