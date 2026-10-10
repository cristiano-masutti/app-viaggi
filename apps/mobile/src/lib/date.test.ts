import { describe, expect, it } from '@jest/globals';

import { buildEmptyDays, dateRange, daysBetween, fromISO, parseItalianDate, shortDate, toISO } from '@/lib/date';

describe('date helpers', () => {
  it('counts trip days inclusively', () => {
    expect(daysBetween('2026-09-14', '2026-09-23')).toBe(10);
    expect(daysBetween('2026-10-12', '2026-10-12')).toBe(1);
  });

  it('counts across the daylight saving change without drifting', () => {
    expect(daysBetween('2026-10-20', '2026-11-02')).toBe(14);
  });

  it('reads ISO dates as local dates, without the UTC shift', () => {
    expect(toISO(fromISO('2026-01-01'))).toBe('2026-01-01');
  });

  it('formats labels the way the cards show them', () => {
    expect(shortDate('2026-09-16')).toBe('16 Set');
    expect(dateRange('2026-10-12', '2026-10-24')).toBe('12 – 24 Ottobre');
    expect(dateRange('2026-12-28', '2027-01-04')).toBe('28 Dicembre – 4 Gennaio');
  });

  it('parses Italian dates and rejects impossible ones', () => {
    expect(toISO(parseItalianDate('12/10/2026')!)).toBe('2026-10-12');
    expect(parseItalianDate('31/02/2026')).toBeNull();
    expect(parseItalianDate('12/10')).toBeNull();
  });

  it('builds empty days G1…Gn for a new trip', () => {
    expect(buildEmptyDays('2026-09-30', 3).map(({ id, date }) => [id, date])).toEqual([
      ['G1', '30 Set'],
      ['G2', '1 Ott'],
      ['G3', '2 Ott'],
    ]);
  });
});
