import type { Prisma } from '../../generated/prisma/client.js';
import { countDays } from '../trips/days.js';
import { tripStatus } from '../trips/trip-status.js';
import { assessReadiness } from './readiness.js';

/**
 * Come il pannello legge i viaggi: una query con tutto ciò che serve alla
 * card (crew, alloggi, conteggi) e una funzione che ne ricava la forma di
 * `AdminTripSummaryDto`, checklist compresa.
 */

/** Ciò che serve dei membri: nomi per la card, passaporto solo per la checklist. */
const memberSelect = {
  userId: true,
  role: true,
  joinedAt: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      passportNumber: true,
      passportExpiry: true,
    },
  },
} as const satisfies Prisma.TripMemberSelect;

export const adminTripInclude = {
  members: {
    select: memberSelect,
    // Coordinatori per primi, poi per ingresso: ordine totale, stabile.
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }, { userId: 'asc' }],
  },
  stays: { select: { dayIndex: true } },
  insurance: { select: { tripId: true } },
  _count: {
    select: {
      invitations: { where: { acceptedAt: null } },
      transports: true,
      emergencies: true,
      memories: { where: { kind: { in: ['photo', 'video'] } } },
    },
  },
} as const satisfies Prisma.TripInclude;

export type AdminTripRow = Prisma.TripGetPayload<{ include: typeof adminTripInclude }>;

export function toAdminTripSummary(trip: AdminTripRow, today: Date) {
  const totalDays = countDays(trip.startDate, trip.endDate);

  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    totalDays,
    status: tripStatus(trip, today),
    crewCapacity: trip.crewCapacity,
    members: trip.members.length,
    pendingInvitations: trip._count.invitations,
    coordinators: trip.members
      .filter((member) => member.role === 'coordinator')
      .map(({ userId, user }) => ({ userId, firstName: user.firstName, lastName: user.lastName })),
    mediaCount: trip._count.memories,
    readiness: assessReadiness({
      startDate: trip.startDate,
      endDate: trip.endDate,
      totalDays,
      stayDays: trip.stays.map((stay) => stay.dayIndex),
      hasInsurance: trip.insurance !== null,
      transports: trip._count.transports,
      emergencyContacts: trip._count.emergencies,
      members: trip.members.map(({ user }) => user),
    }),
  };
}

export const passportStatus = (user: { passportNumber: string | null; passportExpiry: string | null }) => ({
  present: !!user.passportNumber,
  expiry: user.passportNumber ? user.passportExpiry : null,
});

/** Ogni parola cercata deve comparire in almeno uno dei campi, senza badare alle maiuscole. */
export function searchWhere<Field extends string>(q: string | undefined, fields: readonly Field[]) {
  const words = (q ?? '').split(/\s+/).filter(Boolean).slice(0, 5);
  return words.map((word) => ({
    OR: fields.map((field) => ({ [field]: { contains: word, mode: 'insensitive' as const } })),
  })) as Array<{ OR: Array<Record<Field, { contains: string; mode: 'insensitive' }>> }>;
}
