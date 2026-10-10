import { describe, expect, it } from 'vitest';

import { tripStatus, utcToday } from '../../src/modules/trips/trip-status.js';

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const trip = { startDate: date('2027-09-14'), endDate: date('2027-09-23') };

describe('tripStatus', () => {
  it('is ongoing from the first to the last day, both included', () => {
    expect(tripStatus(trip, date('2027-09-13'))).toBe('upcoming');
    expect(tripStatus(trip, date('2027-09-14'))).toBe('ongoing');
    expect(tripStatus(trip, date('2027-09-23'))).toBe('ongoing');
    expect(tripStatus(trip, date('2027-09-24'))).toBe('past');
  });
});

describe('utcToday', () => {
  it('drops the time of day', () => {
    expect(utcToday(new Date('2027-09-14T23:59:59.000Z'))).toEqual(date('2027-09-14'));
  });
});
