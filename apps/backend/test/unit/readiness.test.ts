import { describe, expect, it } from 'vitest';

import {
  assessReadiness,
  passportValidUntil,
  type ReadinessInput,
} from '../../src/modules/admin/readiness.js';

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Viaggio di 4 giorni (3 notti), tutto in ordine. */
const ready: ReadinessInput = {
  startDate: date('2027-09-14'),
  endDate: date('2027-09-17'),
  totalDays: 4,
  stayDays: [1, 2, 3],
  hasInsurance: true,
  transports: 1,
  emergencyContacts: 2,
  members: [
    { passportNumber: 'YA1', passportExpiry: '04/2031' },
    { passportNumber: 'YA2', passportExpiry: '12/2030' },
  ],
};

describe('assessReadiness', () => {
  it('finds nothing to fix in a trip that is ready', () => {
    expect(assessReadiness(ready)).toEqual({
      stays: { covered: 3, needed: 3 },
      insurance: true,
      transport: true,
      emergencyContacts: true,
      passports: { ready: 2, total: 2, expiring: 0 },
      issues: [],
    });
  });

  it('needs a stay for every night but the last day, when you go home', () => {
    const lastDayOnly = assessReadiness({ ...ready, stayDays: [1, 2, 4] });
    expect(lastDayOnly.stays).toEqual({ covered: 2, needed: 3 });
    expect(lastDayOnly.issues).toEqual(['MISSING_STAYS']);

    // Gita in giornata: nessuna notte, niente da coprire.
    const dayTrip = assessReadiness({ ...ready, totalDays: 1, endDate: ready.startDate, stayDays: [] });
    expect(dayTrip.stays).toEqual({ covered: 0, needed: 0 });
    expect(dayTrip.issues).toEqual([]);
  });

  it('lists every missing piece, in a stable order', () => {
    const empty = assessReadiness({
      ...ready,
      stayDays: [],
      hasInsurance: false,
      transports: 0,
      emergencyContacts: 0,
      members: [{ passportNumber: null, passportExpiry: null }, ready.members[0]!],
    });

    expect(empty.issues).toEqual([
      'MISSING_STAYS',
      'NO_INSURANCE',
      'NO_TRANSPORT',
      'NO_EMERGENCY_CONTACTS',
      'MISSING_PASSPORTS',
    ]);
    expect(empty.passports).toEqual({ ready: 1, total: 2, expiring: 0 });
  });

  it('flags a passport that expires less than six months after the return', () => {
    // Rientro 17/09/2027: serve un passaporto valido almeno fino al 17/03/2028.
    const tooSoon = assessReadiness({
      ...ready,
      members: [{ passportNumber: 'YA1', passportExpiry: '02/2028' }],
    });
    const justEnough = assessReadiness({
      ...ready,
      members: [{ passportNumber: 'YA1', passportExpiry: '03/2028' }],
    });

    expect(tooSoon.passports.expiring).toBe(1);
    expect(tooSoon.issues).toEqual(['PASSPORTS_EXPIRING']);
    expect(justEnough.issues).toEqual([]);
  });

  it('does not count an empty crew as missing passports', () => {
    expect(assessReadiness({ ...ready, members: [] }).issues).toEqual([]);
  });
});

describe('passportValidUntil', () => {
  it('reads MM/AAAA as the last day of that month', () => {
    expect(passportValidUntil('02/2028')).toEqual(date('2028-02-29'));
    expect(passportValidUntil('12/2030')).toEqual(date('2030-12-31'));
  });

  it('ignores what it cannot read', () => {
    for (const value of ['13/2030', '2030-12', '4/2030', '']) expect(passportValidUntil(value)).toBeNull();
  });
});
