import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { isoDate, isoDateTime } from '../../src/lib/schemas.js';
import { CreateTripBody } from '../../src/modules/trips/trips.schemas.js';

describe('isoDate', () => {
  it('decodes a calendar date to UTC midnight, whatever the server time zone', () => {
    expect(isoDate.parse('2026-03-29').toISOString()).toBe('2026-03-29T00:00:00.000Z');
  });

  it('encodes back to the same calendar date', () => {
    expect(z.encode(isoDate, new Date('2026-03-29T00:00:00.000Z'))).toBe('2026-03-29');
  });

  it.each(['2026-02-30', '29/03/2026', '2026-03-29T10:00:00Z', ''])('rejects %j', (value) => {
    expect(isoDate.safeParse(value).success).toBe(false);
  });
});

describe('isoDateTime', () => {
  it('accepts an offset and normalises to UTC on the way out', () => {
    const date = isoDateTime.parse('2026-03-29T10:00:00+02:00');
    expect(z.encode(isoDateTime, date)).toBe('2026-03-29T08:00:00.000Z');
  });
});

describe('CreateTripBody', () => {
  const valid = {
    title: 'Giappone Discovery 🇯🇵',
    destination: 'Giappone',
    startDate: '2026-11-01',
    endDate: '2026-11-12',
  };

  it('accepts a valid trip and trims the text fields', () => {
    const parsed = CreateTripBody.parse({ ...valid, title: '  Giappone  ' });
    expect(parsed.title).toBe('Giappone');
  });

  it('accepts a single-day trip', () => {
    expect(CreateTripBody.safeParse({ ...valid, endDate: valid.startDate }).success).toBe(true);
  });

  it('rejects an end date before the start date, pointing at endDate', () => {
    const result = CreateTripBody.safeParse({ ...valid, endDate: '2026-10-31' });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['endDate']);
  });

  it.each([
    ['title', 'A'],
    ['title', 'x'.repeat(121)],
    ['destination', ' '],
  ])('rejects an invalid %s', (field, value) => {
    expect(CreateTripBody.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });
});
