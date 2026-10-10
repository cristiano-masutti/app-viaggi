import type { Document, Prisma, PrismaClient } from '../../generated/prisma/client.js';
import type { TripRole } from '../../generated/prisma/enums.js';
import { memberUserSelect, toMemberDto } from '../crew/crew.schemas.js';
import { toDocumentDto } from '../documents/documents.schemas.js';
import { toPassportDto } from '../me/me.schemas.js';
import { countDays, dayDate } from './days.js';

/** Foto e video che `userId` può vedere: quelli della crew e i propri privati. */
export const visibleMediaWhere = (userId: string): Prisma.MemoryWhereInput => ({
  kind: { in: ['photo', 'video'] },
  OR: [{ visibility: 'crew' }, { authorId: userId }],
});

const withDocument = { include: { document: true } } as const;

/**
 * La crew nell'ordine in cui la mostra il client: coordinatori per primi, poi
 * per data di ingresso. L'ordine è totale (a parità di istante decide l'id),
 * così la stessa crew non cambia ordine da una richiesta all'altra.
 */
export const crewInclude = {
  include: { user: { select: memberUserSelect } },
  orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }, { userId: 'asc' }],
} as const satisfies Prisma.Trip$membersArgs;

const docOf = (slot: { document: Document | null } | null) =>
  slot?.document ? toDocumentDto(slot.document) : null;

/**
 * Il viaggio completo per `userId`, nella forma di `TripDetailDto`: crew,
 * giorni con alloggio e attività, documenti fissi, card SOS. Una sola query
 * per il viaggio più una per il passaporto di chi chiede.
 */
export async function loadTripDetail(prisma: PrismaClient, tripId: string, userId: string, myRole: TripRole) {
  const [trip, me] = await Promise.all([
    prisma.trip.findUniqueOrThrow({
      where: { id: tripId },
      include: {
        members: crewInclude,
        invitations: { where: { acceptedAt: null }, orderBy: [{ createdAt: 'asc' }, { name: 'asc' }] },
        stays: withDocument,
        activities: { ...withDocument, orderBy: [{ dayIndex: 'asc' }, { position: 'asc' }] },
        transports: {
          include: { docs: { ...withDocument, orderBy: { position: 'asc' } } },
          orderBy: { position: 'asc' },
        },
        insurance: withDocument,
        customs: withDocument,
        emergencies: { orderBy: { position: 'asc' } },
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passportNumber: true, passportExpiry: true, passportPhotoPath: true },
    }),
  ]);

  const totalDays = countDays(trip.startDate, trip.endDate);
  const staysByDay = new Map(trip.stays.map((stay) => [stay.dayIndex, stay]));

  const days = Array.from({ length: totalDays }, (_, offset) => {
    const index = offset + 1;
    const stay = staysByDay.get(index);
    return {
      index,
      date: dayDate(trip.startDate, index),
      stay: stay ? { ...stay, doc: docOf(stay) } : null,
      activities: trip.activities
        .filter((activity) => activity.dayIndex === index)
        .map((activity) => ({ ...activity, doc: docOf(activity) })),
    };
  });

  return {
    ...trip,
    totalDays,
    myRole,
    crew: trip.members.map(toMemberDto),
    days,
    documents: {
      passport: toPassportDto(me),
      customs: trip.customs ? { ...trip.customs, doc: docOf(trip.customs) } : null,
      transports: trip.transports.map((transport) => ({
        ...transport,
        docs: transport.docs.map((doc) => ({ id: doc.id, label: doc.label, doc: docOf(doc) })),
      })),
      insurance: trip.insurance ? { ...trip.insurance, doc: docOf(trip.insurance) } : null,
    },
  };
}
