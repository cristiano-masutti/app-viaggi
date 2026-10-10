import { describe, expect, it } from 'vitest';

import { dateRange, dayOf, daysBetween, longDate, shortDate, todayISO } from './dates';

describe('dates', () => {
  it('writes ranges the way the app does', () => {
    expect(dateRange('2027-09-14', '2027-09-23')).toBe('14–23 Set 2027');
    expect(dateRange('2027-09-28', '2027-10-03')).toBe('28 Set – 3 Ott 2027');
    expect(dateRange('2027-12-28', '2028-01-03')).toBe('28 Dic 2027 – 3 Gen 2028');
    expect(dateRange('2027-09-14', '2027-09-14')).toBe('14 Set 2027');
  });

  it('counts whole days across the daylight saving change', () => {
    // In Italia l'ora legale finisce l'ultima domenica di ottobre.
    expect(daysBetween('2027-10-30', '2027-11-01')).toBe(2);
    expect(daysBetween('2027-09-23', '2027-09-14')).toBe(-9);
  });

  it("uses the viewer's local date for today", () => {
    // 23:30 del 14 in Italia è già il 14 sera, non il 15 UTC né il 13.
    expect(todayISO(new Date('2027-09-14T21:30:00.000Z'))).toBe('2027-09-14');
    expect(todayISO(new Date('2027-09-14T22:30:00.000Z'))).toBe('2027-09-15');
  });

  it('labels single days', () => {
    expect(shortDate('2027-09-04')).toBe('4 Set');
    expect(longDate('2027-09-04')).toBe('4 Set 2027');
    expect(dayOf('2027-10-03T08:00:00.000Z')).toBe('3 Ott 2027');
  });
});
