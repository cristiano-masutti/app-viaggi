import type { AdminTripSummary, ReadinessIssue, TripStatus } from '@/api/types';

import { daysBetween } from './dates';

/** La pillola della card, con le stesse parole dell'app. */
export function tripBadge(trip: Pick<AdminTripSummary, 'status' | 'startDate' | 'totalDays'>, today: string) {
  if (trip.status === 'ongoing') {
    const day = Math.min(trip.totalDays, daysBetween(trip.startDate, today) + 1);
    return `LIVE • GIORNO ${day} DI ${trip.totalDays}`;
  }
  if (trip.status === 'past') return '🎒 Concluso';

  const missing = daysBetween(today, trip.startDate);
  if (missing <= 0) return '⏳ Si parte oggi!';
  if (missing === 1) return '⏳ Si parte domani!';
  return `⏳ Mancano ${missing} giorni`;
}

export const STATUS_LABELS: Record<TripStatus, string> = {
  ongoing: 'In corso',
  upcoming: 'Futuri',
  past: 'Passati',
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "8 su 10 posti" (riserve comprese), oppure "5 persone" se il viaggio non ha capienza. */
export function seatsLabel(trip: Pick<AdminTripSummary, 'members' | 'pendingInvitations' | 'crewCapacity'>) {
  const taken = trip.members + trip.pendingInvitations;
  if (trip.crewCapacity === null) return plural(taken, 'persona', 'persone');
  return `${taken} su ${trip.crewCapacity} posti`;
}

/** Quanto è pieno, da 0 a 1; `null` senza capienza. */
export function fillRatio(trip: Pick<AdminTripSummary, 'members' | 'pendingInvitations' | 'crewCapacity'>) {
  if (!trip.crewCapacity) return null;
  return Math.min(1, (trip.members + trip.pendingInvitations) / trip.crewCapacity);
}

/** Cosa manca, in parole: "3 notti senza alloggio", "Senza assicurazione"… */
export function issueLabel(issue: ReadinessIssue, readiness: AdminTripSummary['readiness']): string {
  switch (issue) {
    case 'MISSING_STAYS': {
      const missing = readiness.stays.needed - readiness.stays.covered;
      return `${plural(missing, 'notte', 'notti')} senza alloggio`;
    }
    case 'NO_INSURANCE':
      return 'Senza assicurazione';
    case 'NO_TRANSPORT':
      return 'Nessun mezzo';
    case 'NO_EMERGENCY_CONTACTS':
      return 'Nessun contatto SOS';
    case 'MISSING_PASSPORTS': {
      const missing = readiness.passports.total - readiness.passports.ready;
      return `${plural(missing, 'passaporto mancante', 'passaporti mancanti')}`;
    }
    case 'PASSPORTS_EXPIRING':
      return `${plural(readiness.passports.expiring, 'passaporto in scadenza', 'passaporti in scadenza')}`;
  }
}

export const coordinatorsLabel = (trip: Pick<AdminTripSummary, 'coordinators'>) =>
  trip.coordinators.length === 0
    ? 'Nessun coordinatore'
    : trip.coordinators.map((person) => `${person.firstName} ${person.lastName}`.trim()).join(', ');

/** Il link che il coordinatore condivide nella crew, come nell'app. */
export const inviteLink = (inviteCode: string) => `vibemakers.travel/join/${inviteCode}`;
