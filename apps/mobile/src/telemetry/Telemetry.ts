/**
 * Metriche d'uso e di prestazioni dell'app.
 *
 * Gli eventi e i campioni si accumulano in memoria e partono a lotti verso
 * `POST /api/telemetry`: ogni 30 secondi, quando l'app va in background e
 * quando la coda si riempie. Niente contenuti: nomi di schermate e di chiamate,
 * durate, istanti. Se la rete non c'è restano in coda (fino a un limite, poi si
 * perdono i più vecchi); se il server li rifiuta come non validi si scartano,
 * per non riprovare all'infinito un lotto che non passerà mai.
 */

export type EventName = 'app_open' | 'screen_view' | 'document_open';
export type Metric = 'app_start' | 'screen_ready' | 'api_latency' | 'slow_frames' | 'frozen_frames';
export type Platform = 'ios' | 'android' | 'web';

export interface TelemetryEvent {
  name: EventName;
  screen?: string;
  tripId?: string;
  occurredAt: string;
}

export interface TelemetrySample {
  metric: Metric;
  target?: string;
  value: number;
  occurredAt: string;
}

export interface TelemetryBatch {
  source: 'app';
  platform: Platform;
  appVersion?: string;
  events: TelemetryEvent[];
  samples: TelemetrySample[];
}

/** Come va un invio: `rejected` = il server non lo vuole (4xx), inutile riprovare. */
export type SendResult = 'ok' | 'rejected' | 'failed';

export interface TelemetryOptions {
  /** Nel prototipo (dati mock) non si registra niente. */
  enabled: boolean;
  platform: Platform;
  appVersion?: string;
  now?: () => Date;
  /** Oltre, si perdono i più vecchi: la memoria del telefono non è un archivio. */
  maxQueue?: number;
}

const MAX_EVENTS_PER_BATCH = 50;
const MAX_SAMPLES_PER_BATCH = 100;
/** Con tanti eventi in attesa non si aspetta il timer. */
export const FLUSH_THRESHOLD = 20;

export class Telemetry {
  private events: TelemetryEvent[] = [];
  private samples: TelemetrySample[] = [];
  private send: ((batch: TelemetryBatch) => Promise<SendResult>) | null = null;
  private flushing: Promise<void> | null = null;
  private readonly now: () => Date;
  private readonly maxQueue: number;
  private readonly onceKeys = new Set<string>();
  /** Cresce a ogni uscita: un lotto partito prima non rimette in coda eventi di chi è uscito. */
  private person = 0;

  constructor(private readonly options: TelemetryOptions) {
    this.now = options.now ?? (() => new Date());
    this.maxQueue = options.maxQueue ?? 200;
  }

  /**
   * Collega l'invio al backend. Prima del collegamento si registra comunque
   * (il tempo di avvio si misura prima che lo store sia pronto) e si manda dopo.
   */
  connect(send: ((batch: TelemetryBatch) => Promise<SendResult>) | null) {
    this.send = send;
  }

  get enabled() {
    return this.options.enabled;
  }

  get pending() {
    return { events: this.events.length, samples: this.samples.length };
  }

  event(name: EventName, details: { screen?: string; tripId?: string } = {}) {
    if (!this.enabled) return;
    this.events.push({ name, ...details, occurredAt: this.now().toISOString() });
    this.trim();
    if (this.events.length >= FLUSH_THRESHOLD) void this.flush();
  }

  sample(metric: Metric, value: number, target?: string) {
    if (!this.enabled || !Number.isFinite(value) || value < 0) return;
    this.samples.push({
      metric,
      value: Math.round(value * 10) / 10,
      target,
      occurredAt: this.now().toISOString(),
    });
    this.trim();
  }

  /** Un campione che ha senso una volta sola per avvio (es. il tempo di avvio). */
  sampleOnce(key: string, metric: Metric, value: number, target?: string) {
    if (this.onceKeys.has(key) || !this.enabled) return;
    this.onceKeys.add(key);
    this.sample(metric, value, target);
  }

  /**
   * Chi esce dall'account si porta via i suoi eventi: partirebbero col token di
   * chi entra dopo. I campioni di prestazioni sono anonimi e restano.
   */
  forgetPerson() {
    this.events = [];
    this.person += 1;
  }

  /** Manda quello che c'è, a lotti. Un solo invio alla volta. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.drain().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async drain() {
    while (this.send && (this.events.length > 0 || this.samples.length > 0)) {
      const person = this.person;
      const events = this.events.splice(0, MAX_EVENTS_PER_BATCH);
      const samples = this.samples.splice(0, MAX_SAMPLES_PER_BATCH);
      let result: SendResult;
      try {
        result = await this.send({
          source: 'app',
          platform: this.options.platform,
          appVersion: this.options.appVersion,
          events,
          samples,
        });
      } catch {
        result = 'failed';
      }
      if (result === 'failed') {
        // Si riprova al prossimo giro, nello stesso ordine; gli eventi solo se la persona è la stessa.
        if (this.person === person) this.events.unshift(...events);
        this.samples.unshift(...samples);
        this.trim();
        return;
      }
    }
  }

  private trim() {
    if (this.events.length > this.maxQueue) this.events.splice(0, this.events.length - this.maxQueue);
    if (this.samples.length > this.maxQueue) this.samples.splice(0, this.samples.length - this.maxQueue);
  }
}
