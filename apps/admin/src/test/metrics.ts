import type { AdminPerformance, AdminUsage } from '@/api/types';

/** Risposte d'esempio delle metriche, piccole ma con ogni caso: mai entrato, assente, viaggio in corso. */
export function usageFixture(overrides: Partial<AdminUsage> = {}): AdminUsage {
  return {
    from: '2027-09-08',
    to: '2027-09-14',
    activeUsers: { today: 5, week: 9, month: 14 },
    people: 20,
    daily: Array.from({ length: 7 }, (_, index) => ({
      day: `2027-09-${String(8 + index).padStart(2, '0')}`,
      activeUsers: 3 + index,
      appOpens: 10 + index * 2,
      documentOpens: index,
    })),
    screens: [
      { screen: 'MyTrips', views: 120, users: 9 },
      { screen: 'TripDetail', views: 85, users: 8 },
    ],
    platforms: [
      { platform: 'ios', users: 6 },
      { platform: 'android', users: 3 },
    ],
    inactive: {
      total: 2,
      people: [
        {
          userId: '00000000-0000-4000-8000-000000000001',
          firstName: 'Hana',
          lastName: 'Sato',
          email: 'hana@example.test',
          lastSeenAt: null,
          trip: {
            tripId: '00000000-0000-4000-8000-0000000000a1',
            title: 'Islanda in camper',
            startDate: '2027-09-20',
          },
        },
        {
          userId: '00000000-0000-4000-8000-000000000002',
          firstName: 'Marco',
          lastName: 'Riva',
          email: 'marco@example.test',
          lastSeenAt: '2027-08-20T10:00:00.000Z',
          trip: {
            tripId: '00000000-0000-4000-8000-0000000000a1',
            title: 'Islanda in camper',
            startDate: '2027-09-20',
          },
        },
      ],
    },
    liveTrips: [
      {
        tripId: '00000000-0000-4000-8000-0000000000b1',
        title: 'Giappone d’autunno',
        members: 6,
        activeMembers: 4,
        documentOpens: 12,
      },
    ],
    ...overrides,
  };
}

export function performanceFixture(overrides: Partial<AdminPerformance> = {}): AdminPerformance {
  return {
    source: 'app',
    from: '2027-09-08',
    to: '2027-09-14',
    metrics: [
      { metric: 'app_start', count: 40, p50: 1400, p75: 1850, p95: 3200 },
      { metric: 'screen_ready', count: 120, p50: 600, p75: 1300, p95: 2600 },
      { metric: 'api_latency', count: 400, p50: 180, p75: 260, p95: 900 },
      { metric: 'slow_frames', count: 60, p50: 4, p75: 18, p95: 30 },
    ],
    daily: [
      { day: '2027-09-08', metric: 'app_start', p75: 2100, count: 5 },
      { day: '2027-09-10', metric: 'app_start', p75: 1700, count: 8 },
      { day: '2027-09-14', metric: 'app_start', p75: 1600, count: 6 },
    ],
    targets: [
      { metric: 'screen_ready', target: 'TripDetail', count: 60, p50: 900, p75: 2700, p95: 4100 },
      { metric: 'api_latency', target: 'GET /api/trips/{tripId}', count: 90, p50: 220, p75: 340, p95: 1200 },
    ],
    platforms: [
      { platform: 'ios', metric: 'app_start', p75: 1500, count: 20 },
      { platform: 'android', metric: 'app_start', p75: 2300, count: 20 },
    ],
    ...overrides,
  };
}
