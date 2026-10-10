import { describe, expect, it } from 'vitest';

import type { AdminTripSummary } from '@/api/types';

import { coordinatorsLabel, fillRatio, issueLabel, seatsLabel, tripBadge } from './trips';

const readiness: AdminTripSummary['readiness'] = {
  stays: { covered: 6, needed: 9 },
  insurance: false,
  transport: true,
  emergencyContacts: true,
  passports: { ready: 5, total: 6, expiring: 2 },
  issues: [],
};

describe('tripBadge', () => {
  const trip = { startDate: '2027-09-14', totalDays: 10 };

  it('speaks like the app: live day, countdown, done', () => {
    expect(tripBadge({ ...trip, status: 'ongoing' }, '2027-09-16')).toBe('LIVE • GIORNO 3 DI 10');
    expect(tripBadge({ ...trip, status: 'upcoming' }, '2027-08-27')).toBe('⏳ Mancano 18 giorni');
    expect(tripBadge({ ...trip, status: 'upcoming' }, '2027-09-13')).toBe('⏳ Si parte domani!');
    expect(tripBadge({ ...trip, status: 'past' }, '2027-10-01')).toBe('🎒 Concluso');
  });
});

describe('seats', () => {
  it('counts reserved places as taken', () => {
    const trip = { members: 7, pendingInvitations: 2, crewCapacity: 10 };
    expect(seatsLabel(trip)).toBe('9 su 10 posti');
    expect(fillRatio(trip)).toBeCloseTo(0.9);
  });

  it('has no ratio without a capacity, and never goes past full', () => {
    expect(seatsLabel({ members: 1, pendingInvitations: 0, crewCapacity: null })).toBe('1 persona');
    expect(fillRatio({ members: 5, pendingInvitations: 0, crewCapacity: null })).toBeNull();
    expect(fillRatio({ members: 5, pendingInvitations: 1, crewCapacity: 4 })).toBe(1);
  });
});

describe('issueLabel', () => {
  it('says what is missing, with the numbers', () => {
    expect(issueLabel('MISSING_STAYS', readiness)).toBe('3 notti senza alloggio');
    expect(issueLabel('NO_INSURANCE', readiness)).toBe('Senza assicurazione');
    expect(issueLabel('MISSING_PASSPORTS', readiness)).toBe('1 passaporto mancante');
    expect(issueLabel('PASSPORTS_EXPIRING', readiness)).toBe('2 passaporti in scadenza');
    expect(issueLabel('MISSING_STAYS', { ...readiness, stays: { covered: 8, needed: 9 } })).toBe(
      '1 notte senza alloggio',
    );
  });
});

describe('coordinatorsLabel', () => {
  it('lists every coordinator', () => {
    expect(
      coordinatorsLabel({
        coordinators: [
          { userId: 'a', firstName: 'Sofia', lastName: 'Marchi' },
          { userId: 'b', firstName: 'Luca', lastName: '' },
        ],
      }),
    ).toBe('Sofia Marchi, Luca');
    expect(coordinatorsLabel({ coordinators: [] })).toBe('Nessun coordinatore');
  });
});
