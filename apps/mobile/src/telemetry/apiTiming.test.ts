import { describe, expect, it, jest } from '@jest/globals';
import createClient from 'openapi-fetch';

import type { paths } from '@/api/schema';

import { apiTimingMiddleware, templatePath } from './apiTiming';
import { Telemetry } from './Telemetry';

describe('templatePath', () => {
  it('groups calls by route, not by trip', () => {
    expect(templatePath('/api/trips/2f1c4b6e-0000-4000-8000-000000000001/documents?x=1')).toBe(
      '/api/trips/{id}/documents',
    );
  });
});

describe('apiTimingMiddleware', () => {
  it('times every call by its route in the specification, except the metrics themselves', async () => {
    const telemetry = new Telemetry({ enabled: true, platform: 'ios' });
    let clock = 0;
    const fetch = jest.fn(async () => {
      clock += 180;
      return new Response(JSON.stringify({}), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      });
    });
    const client = createClient<paths>({
      baseUrl: 'https://api.test',
      fetch: fetch as unknown as typeof globalThis.fetch,
    });
    client.use(apiTimingMiddleware(telemetry, () => clock));
    const sent: unknown[] = [];
    telemetry.connect(async (batch) => {
      sent.push(batch);
      return 'ok';
    });

    await client.GET('/api/trips/{tripId}', { params: { path: { tripId: 'trip-1' } } });
    await client.POST('/api/telemetry', {
      body: { source: 'app', platform: 'ios', events: [], samples: [] },
    });
    await telemetry.flush();

    expect(sent).toEqual([
      expect.objectContaining({
        samples: [
          expect.objectContaining({ metric: 'api_latency', value: 180, target: 'GET /api/trips/{tripId}' }),
        ],
      }),
    ]);
  });
});
