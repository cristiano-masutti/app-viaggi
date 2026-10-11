import type { PerfMetric, TelemetryBatch } from '@/api/types';

/**
 * Le prestazioni del pannello, come le sente lo staff: Web Vitals delle
 * pagine e tempi delle chiamate. Solo campioni anonimi (il pannello non manda
 * eventi d'uso): si accumulano e partono a lotti verso `POST /api/telemetry`.
 */

export type SendResult = 'ok' | 'rejected' | 'failed';
type Sample = NonNullable<TelemetryBatch['samples']>[number];

const MAX_SAMPLES_PER_BATCH = 100;
const MAX_QUEUE = 200;

export class PanelTelemetry {
  private samples: Sample[] = [];
  private send: ((batch: TelemetryBatch) => Promise<SendResult>) | null = null;
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly appVersion?: string,
  ) {}

  connect(send: ((batch: TelemetryBatch) => Promise<SendResult>) | null) {
    this.send = send;
  }

  get pending() {
    return this.samples.length;
  }

  sample(metric: PerfMetric, value: number, target?: string) {
    if (!Number.isFinite(value) || value < 0) return;
    // Il CLS è un punteggio piccolo (0,05): tre decimali; il resto sono millisecondi.
    const rounded = metric === 'cls' ? Math.round(value * 1000) / 1000 : Math.round(value * 10) / 10;
    this.samples.push({ metric, value: rounded, target, occurredAt: this.now().toISOString() });
    if (this.samples.length > MAX_QUEUE) this.samples.splice(0, this.samples.length - MAX_QUEUE);
  }

  /** Un invio alla volta; se la rete manca il lotto torna in coda, se il server lo rifiuta si scarta. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.drain().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async drain() {
    while (this.send && this.samples.length > 0) {
      const samples = this.samples.splice(0, MAX_SAMPLES_PER_BATCH);
      let result: SendResult;
      try {
        result = await this.send({
          source: 'panel',
          platform: 'web',
          appVersion: this.appVersion,
          events: [],
          samples,
        });
      } catch {
        result = 'failed';
      }
      if (result === 'failed') {
        this.samples.unshift(...samples);
        if (this.samples.length > MAX_QUEUE) this.samples.splice(0, this.samples.length - MAX_QUEUE);
        return;
      }
    }
  }
}
