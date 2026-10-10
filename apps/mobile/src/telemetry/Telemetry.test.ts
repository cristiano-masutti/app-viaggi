import { describe, expect, it, jest } from '@jest/globals';

import { FLUSH_THRESHOLD, type SendResult, Telemetry, type TelemetryBatch } from './Telemetry';

const at = new Date('2027-09-14T10:00:00.000Z');
const make = (options: Partial<ConstructorParameters<typeof Telemetry>[0]> = {}) =>
  new Telemetry({ enabled: true, platform: 'ios', appVersion: '1.0.0', now: () => at, ...options });

function transport(results: SendResult[] = []) {
  const batches: TelemetryBatch[] = [];
  const send = jest.fn(async (batch: TelemetryBatch) => {
    batches.push(batch);
    return results.shift() ?? 'ok';
  });
  return { send, batches };
}

describe('Telemetry', () => {
  it('records nothing in the prototype', async () => {
    const telemetry = make({ enabled: false });
    const { send } = transport();
    telemetry.connect(send);

    telemetry.event('app_open');
    telemetry.sample('app_start', 1200);
    await telemetry.flush();

    expect(send).not.toHaveBeenCalled();
  });

  it('keeps what happens before the store is ready, and sends it once connected', async () => {
    const telemetry = make();
    telemetry.sample('app_start', 1834.56, 'Login');
    const { send, batches } = transport();

    await telemetry.flush();
    telemetry.connect(send);
    await telemetry.flush();

    expect(batches).toEqual([
      {
        source: 'app',
        platform: 'ios',
        appVersion: '1.0.0',
        events: [],
        samples: [{ metric: 'app_start', value: 1834.6, target: 'Login', occurredAt: at.toISOString() }],
      },
    ]);
  });

  it('sends in batches the server accepts', async () => {
    const telemetry = make({ maxQueue: 500 });
    const { send, batches } = transport();
    telemetry.connect(send);
    for (let index = 0; index < 120; index += 1) telemetry.sample('api_latency', index, 'GET /api/trips');

    await telemetry.flush();

    expect(batches.map((batch) => batch.samples.length)).toEqual([100, 20]);
  });

  it('flushes by itself when many events are waiting', async () => {
    const telemetry = make();
    const { send } = transport();
    telemetry.connect(send);

    for (let index = 0; index < FLUSH_THRESHOLD; index += 1)
      telemetry.event('screen_view', { screen: 'MyTrips' });
    await telemetry.flush();

    expect(send).toHaveBeenCalled();
    expect(telemetry.pending.events).toBe(0);
  });

  it('keeps the batch for later when the network is down, in the same order', async () => {
    const telemetry = make();
    const { send, batches } = transport(['failed']);
    telemetry.connect(send);
    telemetry.event('app_open');
    telemetry.event('document_open', { tripId: 'trip-1' });

    await telemetry.flush();
    expect(telemetry.pending.events).toBe(2);
    await telemetry.flush();

    expect(batches[1]!.events.map((event) => event.name)).toEqual(['app_open', 'document_open']);
    expect(telemetry.pending.events).toBe(0);
  });

  it('drops a batch the server refuses, instead of retrying it forever', async () => {
    const telemetry = make();
    const { send } = transport(['rejected']);
    telemetry.connect(send);
    telemetry.event('app_open');

    await telemetry.flush();

    expect(telemetry.pending.events).toBe(0);
  });

  it('never grows past its limit: the oldest go first', () => {
    const telemetry = make({ maxQueue: 3 });
    for (const value of [1, 2, 3, 4, 5]) telemetry.sample('app_start', value);
    expect(telemetry.pending.samples).toBe(3);
  });

  it("forgets the person's events on sign out, but keeps the anonymous samples", () => {
    const telemetry = make();
    telemetry.event('app_open');
    telemetry.sample('screen_ready', 300, 'MyTrips');

    telemetry.forgetPerson();

    expect(telemetry.pending).toEqual({ events: 0, samples: 1 });
  });

  it("never puts back a signed-out person's events when their batch fails", async () => {
    const telemetry = make();
    let finish: (result: SendResult) => void = () => undefined;
    const send = jest.fn(() => new Promise<SendResult>((resolve) => (finish = resolve)));
    telemetry.connect(send);
    telemetry.event('document_open', { tripId: 'trip-1' });
    telemetry.sample('screen_ready', 300, 'MyTrips');

    // Il lotto parte, la persona esce mentre è in volo, la rete fallisce.
    const flushed = telemetry.flush();
    telemetry.forgetPerson();
    finish('failed');
    await flushed;

    expect(telemetry.pending).toEqual({ events: 0, samples: 1 });
  });

  it('measures the start of the app only once', () => {
    const telemetry = make();
    telemetry.sampleOnce('app_start', 'app_start', 1500);
    telemetry.sampleOnce('app_start', 'app_start', 9000);
    expect(telemetry.pending.samples).toBe(1);
  });
});
