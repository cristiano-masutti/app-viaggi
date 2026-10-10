import { describe, expect, it } from 'vitest';

import { AppError } from '../../src/lib/errors.js';
import {
  assertDayInTrip,
  assertValidDates,
  countDays,
  dayDate,
  MAX_TRIP_DAYS,
} from '../../src/modules/trips/days.js';

const date = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const trip = { startDate: date('2026-09-14'), endDate: date('2026-09-23') };

describe('trip days', () => {
  it('counts days inclusively', () => {
    expect(countDays(trip.startDate, trip.endDate)).toBe(10);
    expect(countDays(trip.startDate, trip.startDate)).toBe(1);
  });

  it('counts across a daylight saving change without drifting', () => {
    expect(countDays(date('2026-10-20'), date('2026-11-02'))).toBe(14);
  });

  it('dates each day from the start', () => {
    expect(dayDate(trip.startDate, 1)).toEqual(date('2026-09-14'));
    expect(dayDate(trip.startDate, 10)).toEqual(date('2026-09-23'));
  });

  it.each([0, 11, -1])('refuses day %i of a 10-day trip', (day) => {
    expect(() => assertDayInTrip(trip, day)).toThrowError(AppError);
  });

  it('accepts the first and the last day', () => {
    expect(() => assertDayInTrip(trip, 1)).not.toThrow();
    expect(() => assertDayInTrip(trip, 10)).not.toThrow();
  });

  const thrownBy = (fn: () => void) => {
    try {
      fn();
    } catch (error) {
      return error;
    }
    return null;
  };

  it('refuses an end before the start, pointing at endDate', () => {
    expect(thrownBy(() => assertValidDates(date('2026-09-14'), date('2026-09-13')))).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: [{ path: '/endDate', message: 'endDate must be on or after startDate' }],
    });
  });

  it(`refuses a trip longer than ${MAX_TRIP_DAYS} days`, () => {
    const start = date('2026-01-01');
    expect(thrownBy(() => assertValidDates(start, dayDate(start, MAX_TRIP_DAYS + 1)))).toBeInstanceOf(
      AppError,
    );
    expect(thrownBy(() => assertValidDates(start, dayDate(start, MAX_TRIP_DAYS)))).toBeNull();
  });
});
