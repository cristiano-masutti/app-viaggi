import type { Prisma } from '../../generated/prisma/client.js';
import type { TripRole } from '../../generated/prisma/enums.js';
import type { PrismaClient } from '../../lib/prisma.js';
import { countDays, dayDate } from '../trips/days.js';
import { tripStatus } from '../trips/trip-status.js';
import { lastSeenByUser } from './metrics.js';
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

export const memberRowSelect = {
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
} as const;

export const toAdminMember = (
  member: {
    userId: string;
    role: TripRole;
    joinedAt: Date;
    user: {
      firstName: string;
      lastName: string;
      username: string | null;
      email: string | null;
      passportNumber: string | null;
      passportExpiry: string | null;
    };
  },
  lastSeen: Map<string, Date> = new Map(),
) => ({
  userId: member.userId,
  firstName: member.user.firstName,
  lastName: member.user.lastName,
  username: member.user.username,
  email: member.user.email,
  role: member.role,
  joinedAt: member.joinedAt,
  passport: passportStatus(member.user),
  lastSeenAt: lastSeen.get(member.userId) ?? null,
});

/**
 * Il viaggio completo come lo vede lo staff: crew con i contatti, posti
 * riservati, programma, logistica e il numero dei ricordi (mai il contenuto).
 * `null` se il viaggio non esiste.
 */
export async function loadAdminTripDetail(prisma: PrismaClient, tripId: string, today: Date) {
  const [trip, memoriesByKind] = await Promise.all([
    prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        ...adminTripInclude,
        members: { ...adminTripInclude.members, select: memberRowSelect },
        invitations: { where: { acceptedAt: null }, orderBy: [{ createdAt: 'asc' }, { name: 'asc' }] },
        stays: { select: { dayIndex: true, name: true, address: true, documentId: true } },
        activities: {
          select: { id: true, dayIndex: true, name: true, place: true, documentId: true },
          orderBy: [{ dayIndex: 'asc' }, { position: 'asc' }],
        },
        insurance: true,
        customs: true,
        transports: { orderBy: { position: 'asc' } },
        emergencies: { orderBy: { position: 'asc' } },
      },
    }),
    prisma.memory.groupBy({ by: ['kind'], where: { tripId }, _count: { _all: true } }),
  ]);
  if (!trip) return null;

  const summary = toAdminTripSummary(trip, today);
  const lastSeen = await lastSeenByUser(
    prisma,
    trip.members.map((member) => member.userId),
  );
  const staysByDay = new Map(trip.stays.map((stay) => [stay.dayIndex, stay]));
  const memories = (kind: string) => memoriesByKind.find((row) => row.kind === kind)?._count._all ?? 0;

  return {
    ...summary,
    inviteCode: trip.inviteCode,
    createdAt: trip.createdAt,
    crew: trip.members.map((member) => toAdminMember(member, lastSeen)),
    invitations: trip.invitations,
    days: Array.from({ length: summary.totalDays }, (_, offset) => {
      const index = offset + 1;
      const stay = staysByDay.get(index);
      return {
        index,
        date: dayDate(trip.startDate, index),
        stay: stay ? { name: stay.name, address: stay.address, hasDocument: stay.documentId !== null } : null,
        activities: trip.activities
          .filter((activity) => activity.dayIndex === index)
          .map(({ id, name, place, documentId }) => ({ id, name, place, hasDocument: documentId !== null })),
      };
    }),
    logistics: {
      insurance: trip.insurance,
      customs: trip.customs,
      transports: trip.transports,
      emergencies: trip.emergencies,
    },
    memories: { photos: memories('photo'), videos: memories('video'), notes: memories('note') },
  };
}
