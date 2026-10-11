import { describe, expect, it } from 'vitest';

import {
  formatMetric,
  lastSeenLabel,
  lastSeenStatus,
  niceTicks,
  percentOf,
  rate,
  screenLabel,
  targetLabel,
} from './metrics';

describe('rate', () => {
  it('judges the p75 against the published thresholds, boundaries included', () => {
    expect(rate('lcp', 2500)).toBe('ok');
    expect(rate('lcp', 2501)).toBe('warn');
    expect(rate('lcp', 4000)).toBe('warn');
    expect(rate('lcp', 4001)).toBe('bad');
    expect(rate('cls', 0.1)).toBe('ok');
    expect(rate('cls', 0.26)).toBe('bad');
  });

  it('counts any freeze as something to look at', () => {
    expect(rate('frozen_frames', 0)).toBe('ok');
    expect(rate('frozen_frames', 0.5)).toBe('warn');
    expect(rate('frozen_frames', 2)).toBe('bad');
  });
});

describe('formatMetric', () => {
  it('writes times in Italian: milliseconds under a second, seconds above', () => {
    // Fra numero e unità uno spazio non separabile: non vanno mai a capo divisi.
    expect(formatMetric('api_latency', 284.6)).toBe('285\u00a0ms');
    expect(formatMetric('app_start', 1850)).toBe('1,85\u00a0s');
    expect(formatMetric('app_start', 12_340)).toBe('12,3\u00a0s');
  });

  it('writes shares, scores and counts with their own precision', () => {
    expect(formatMetric('slow_frames', 12.46)).toBe('12,5%');
    expect(formatMetric('cls', 0.084)).toBe('0,08');
    expect(formatMetric('frozen_frames', 0.5)).toBe('0,5');
  });
});

describe('niceTicks', () => {
  it('climbs in round steps to just above the largest value', () => {
    expect(niceTicks(12)).toEqual([0, 5, 10, 15]);
    expect(niceTicks(1830)).toEqual([0, 500, 1000, 1500, 2000]);
    expect(niceTicks(0.21)).toEqual([0, 0.1, 0.2, 0.3]);
  });

  it('still draws an axis with no data', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe('percentOf', () => {
  it('never divides by zero', () => {
    expect(percentOf(3, 12)).toBe('25%');
    expect(percentOf(0, 0)).toBe('—');
  });
});

describe('last seen', () => {
  const now = new Date(2027, 8, 14, 18, 0);

  it('reads like a person would say it', () => {
    expect(lastSeenLabel(null, now)).toBe('Mai entrato');
    expect(lastSeenLabel(new Date(2027, 8, 14, 9, 0).toISOString(), now)).toBe('oggi');
    expect(lastSeenLabel(new Date(2027, 8, 13, 23, 30).toISOString(), now)).toBe('ieri');
    expect(lastSeenLabel(new Date(2027, 8, 9, 12, 0).toISOString(), now)).toBe('5 giorni fa');
    expect(lastSeenLabel(new Date(2027, 6, 2, 12, 0).toISOString(), now)).toBe('dal 2 Lug 2027');
  });

  it('flags who never came in, and who has been away for more than two weeks', () => {
    expect(lastSeenStatus(null, now)).toBe('bad');
    expect(lastSeenStatus(new Date(2027, 7, 29, 12, 0).toISOString(), now)).toBe('warn');
    expect(lastSeenStatus(new Date(2027, 8, 1 + 13, 12, 0).toISOString(), now)).toBe('ok');
  });
});

describe('names', () => {
  it('shows app screens with the names travellers see, and keeps unknown ones', () => {
    expect(screenLabel('TripDetail')).toBe('Dettaglio viaggio');
    expect(screenLabel('NewScreen')).toBe('NewScreen');
  });

  it('keeps API calls technical and names panel pages', () => {
    expect(targetLabel('api_latency', 'GET /api/trips/{tripId}')).toBe('GET /api/trips/{tripId}');
    expect(targetLabel('lcp', '/viaggi/:id')).toBe('Scheda viaggio');
    expect(targetLabel('screen_ready', 'MyTrips')).toBe('I miei viaggi');
  });
});
