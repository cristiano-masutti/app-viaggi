import createClient from 'openapi-fetch';
import { describe, expect, it, vi } from 'vitest';

import type { paths } from '@/api/schema';
import type { TelemetryBatch } from '@/api/types';

import { apiTimingMiddleware } from './apiTiming';
import { pagePattern } from './pages';
import { PanelTelemetry, type SendResult } from './PanelTelemetry';

const at = new Date('2027-09-14T10:00:00.000Z');

function transport(results: SendResult[] = []) {
  const batches: TelemetryBatch[] = [];
  const send = vi.fn(async (batch: TelemetryBatch) => {
    batches.push(batch);
    return results.shift() ?? 'ok';
  });
  return { send, batches };
}

describe('PanelTelemetry', () => {
  it('sends anonymous panel samples, never usage events', async () => {
    const telemetry = new PanelTelemetry(() => at);
    const { send, batches } = transport();
    telemetry.connect(send);
    telemetry.sample('lcp', 1834.56, '/viaggi/:id');

    await telemetry.flush();

    expect(batches).toEqual([
      {
        source: 'panel',
        platform: 'web',
        events: [],
        samples: [{ metric: 'lcp', value: 1834.6, target: '/viaggi/:id', occurredAt: at.toISOString() }],
      },
    ]);
  });

  it('keeps three decimals for the layout shift score', async () => {
    const telemetry = new PanelTelemetry(() => at);
    const { send, batches } = transport();
    telemetry.connect(send);
    telemetry.sample('cls', 0.04567);

    await telemetry.flush();

    expect(batches[0]!.samples![0]!.value).toBe(0.046);
  });

  it('keeps the batch when the network fails and drops it when the server refuses it', async () => {
    const telemetry = new PanelTelemetry(() => at);
    const { send } = transport(['failed', 'rejected']);
    telemetry.connect(send);
    telemetry.sample('ttfb', 300);

    await telemetry.flush();
    expect(telemetry.pending).toBe(1);

    await telemetry.flush();
    expect(telemetry.pending).toBe(0);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('ignores impossible values', () => {
    const telemetry = new PanelTelemetry(() => at);
    telemetry.sample('inp', -1);
    telemetry.sample('inp', Number.NaN);
    expect(telemetry.pending).toBe(0);
  });
});

describe('pagePattern', () => {
  it('groups by page, never by trip or person', () => {
    expect(pagePattern('/')).toBe('/');
    expect(pagePattern('/viaggi/2f1c7a54-8a77-4f0e-9c1e-3c1a6f3b9d10')).toBe('/viaggi/:id');
    expect(pagePattern('/persone/abc/')).toBe('/persone/:id');
    expect(pagePattern('/prestazioni')).toBe('/prestazioni');
  });

  it('turns anything unknown into "altro", so no free text reaches the metrics', () => {
    expect(pagePattern('/viaggi/x/y')).toBe('altro');
    expect(pagePattern('/<script>')).toBe('altro');
  });
});

describe('apiTimingMiddleware', () => {
  it('times each call by its route template, and leaves out the telemetry upload', async () => {
    const telemetry = new PanelTelemetry(() => at);
    let clock = 1000;
    const fetch = vi.fn(async () => {
      clock += 240;
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    });
    const client = createClient<paths>({ baseUrl: 'https://api.test', fetch });
    client.use(apiTimingMiddleware(telemetry, () => clock));
    const { send, batches } = transport();
    telemetry.connect(send);

    await client.GET('/api/admin/trips/{tripId}', {
      params: { path: { tripId: '2f1c7a54-8a77-4f0e-9c1e-3c1a6f3b9d10' }, query: {} },
    });
    await client.POST('/api/telemetry', {
      body: { source: 'panel', platform: 'web', events: [], samples: [] },
    });
    await telemetry.flush();

    expect(batches[0]!.samples).toEqual([
      {
        metric: 'api_latency',
        value: 240,
        target: 'GET /api/admin/trips/{tripId}',
        occurredAt: at.toISOString(),
      },
    ]);
  });
});
