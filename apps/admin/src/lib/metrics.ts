import type { AppPlatform, PerfMetric, TelemetrySource } from '@/api/types';
import type { Status } from '@/components/ui/StatusChip';

import { daysBetween, dayOf, todayISO } from './dates';

/**
 * Come si leggono le metriche: cosa misurano, in che unità, quando un valore
 * è buono. Le soglie seguono quelle pubbliche di Google (Web Vitals, Android
 * vitals) dove esistono; per l'app sono quelle che un viaggiatore nota.
 */

export interface MetricInfo {
  label: string;
  description: string;
  unit: 'ms' | 'percent' | 'score' | 'count';
  /** Fino a qui è buono; oltre `poor` è scarso; in mezzo, da migliorare. */
  good: number;
  poor: number;
}

export const METRICS: Record<PerfMetric, MetricInfo> = {
  app_start: {
    label: "Avvio dell'app",
    description: "Dal tocco sull'icona alla prima schermata pronta",
    unit: 'ms',
    good: 2000,
    poor: 4000,
  },
  screen_ready: {
    label: 'Schermate pronte',
    description: "Dall'ingresso in una schermata ai dati a video",
    unit: 'ms',
    good: 1000,
    poor: 2500,
  },
  api_latency: {
    label: 'Risposta del server',
    description: 'Ogni chiamata, rete compresa, vista dal dispositivo',
    unit: 'ms',
    good: 300,
    poor: 1000,
  },
  slow_frames: {
    label: 'Fotogrammi lenti',
    description: 'Quota di fotogrammi oltre 34 ms: lo scatto che si vede scorrendo',
    unit: 'percent',
    good: 5,
    poor: 15,
  },
  frozen_frames: {
    label: 'Blocchi',
    description: "Fotogrammi oltre 700 ms ogni 10 secondi d'uso: l'app che si pianta",
    unit: 'count',
    good: 0,
    poor: 1,
  },
  lcp: {
    label: 'Caricamento',
    description: 'LCP: quando compare il contenuto principale della pagina',
    unit: 'ms',
    good: 2500,
    poor: 4000,
  },
  inp: {
    label: 'Reattività',
    description: 'INP: dal clic alla risposta a schermo, nel caso peggiore della visita',
    unit: 'ms',
    good: 200,
    poor: 500,
  },
  cls: {
    label: 'Stabilità',
    description: 'CLS: quanto si sposta la pagina mentre carica',
    unit: 'score',
    good: 0.1,
    poor: 0.25,
  },
  ttfb: {
    label: 'Primo byte',
    description: 'TTFB: quanto ci mette ad arrivare la pagina del pannello',
    unit: 'ms',
    good: 800,
    poor: 1800,
  },
};

/** Le metriche di ciascuna sorgente, nell'ordine in cui si leggono. */
export const SOURCE_METRICS: Record<TelemetrySource, readonly PerfMetric[]> = {
  app: ['app_start', 'screen_ready', 'api_latency', 'slow_frames', 'frozen_frames'],
  panel: ['lcp', 'inp', 'cls', 'ttfb', 'api_latency'],
};

export const SOURCE_LABELS: Record<TelemetrySource, string> = { app: 'App', panel: 'Pannello' };

export function rate(metric: PerfMetric, value: number): Status {
  const { good, poor } = METRICS[metric];
  return value <= good ? 'ok' : value <= poor ? 'warn' : 'bad';
}

export const RATING_LABELS: Record<Status, string> = { ok: 'Buono', warn: 'Da migliorare', bad: 'Scarso' };

/** `fixed`: sempre quei decimali, così in una riga di percentili le cifre si confrontano ('1,40 s · 3,20 s'). */
const number = (digits: number, fixed = false) =>
  new Intl.NumberFormat('it-IT', {
    maximumFractionDigits: digits,
    minimumFractionDigits: fixed ? digits : 0,
  });

/** '840 ms', '1,85 s', '12,5%', '0,08', '0,5'. */
export function formatMetric(metric: PerfMetric, value: number): string {
  switch (METRICS[metric].unit) {
    case 'ms':
      // Spazio non separabile: '1,48' e 's' restano sulla stessa riga.
      if (value < 1000) return `${number(0).format(value)}\u00a0ms`;
      return `${number(value < 10_000 ? 2 : 1, true).format(value / 1000)}\u00a0s`;
    case 'percent':
      return `${number(1).format(value)}%`;
    case 'score':
      return number(2).format(value);
    case 'count':
      return number(1).format(value);
  }
}

/** I numeri interi del pannello: '1.284'. */
export const formatCount = (value: number) => number(0).format(value);

/** 'il 42%' di qualcosa, senza dividere per zero. */
export const percentOf = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—';

/**
 * Le tacche dell'asse: numeri tondi da 0 a poco sopra il massimo, al più
 * `count` intervalli. `[0, 5, 10, 15]`, `[0, 500, 1000, 1500]`.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * magnitude).find((value) => value >= rough)!;
  const ticks: number[] = [];
  for (let tick = 0; tick < max + step * 0.999; tick += step) ticks.push(Number(tick.toPrecision(12)));
  return ticks.length > 1 ? ticks : [0, step];
}

/* ── Nomi ─────────────────────────────────────────────────────────────── */

const SCREEN_LABELS: Record<string, string> = {
  Login: 'Accesso',
  Main: 'Home',
  MyTrips: 'I miei viaggi',
  TripDetail: 'Dettaglio viaggio',
  Profile: 'Profilo',
  Explore: 'Esplora',
  CreateTrip: 'Nuovo viaggio',
  TripCreatedSuccess: 'Viaggio creato',
};

/** Le schermate dell'app con i nomi che vede chi la usa; una nuova resta col suo nome tecnico. */
export const screenLabel = (screen: string) => SCREEN_LABELS[screen] ?? screen;

const PAGE_LABELS: Record<string, string> = {
  '/': 'Panoramica',
  '/viaggi': 'Viaggi',
  '/viaggi/:id': 'Scheda viaggio',
  '/persone': 'Persone',
  '/persone/:id': 'Scheda persona',
  '/uso': "Uso dell'app",
  '/prestazioni': 'Prestazioni',
  altro: 'Altre pagine',
};

export const pageLabel = (page: string) => PAGE_LABELS[page] ?? page;

/** Il nome di "dove": una schermata, una pagina del pannello o una chiamata (che resta tecnica). */
export function targetLabel(metric: PerfMetric, target: string) {
  if (metric === 'api_latency') return target;
  if (metric === 'lcp' || metric === 'inp' || metric === 'cls' || metric === 'ttfb') return pageLabel(target);
  return screenLabel(target);
}

export const PLATFORM_LABELS: Record<AppPlatform, string> = { ios: 'iPhone', android: 'Android', web: 'Web' };

/* ── Ultimo accesso ───────────────────────────────────────────────────── */

/** Dopo quanti giorni senza aprire l'app una persona in viaggio va cercata (come il backend). */
export const INACTIVE_AFTER_DAYS = 14;

/** 'Mai entrato', 'oggi', 'ieri', '5 giorni fa', 'dal 3 Ott 2027'. */
export function lastSeenLabel(lastSeenAt: string | null, now = new Date()): string {
  if (!lastSeenAt) return 'Mai entrato';
  const days = daysBetween(todayISO(new Date(lastSeenAt)), todayISO(now));
  if (days <= 0) return 'oggi';
  if (days === 1) return 'ieri';
  if (days < 30) return `${days} giorni fa`;
  return `dal ${dayOf(lastSeenAt)}`;
}

/** Mai entrato è il caso da risolvere; assente da settimane, da tenere d'occhio. */
export function lastSeenStatus(lastSeenAt: string | null, now = new Date()): Status {
  if (!lastSeenAt) return 'bad';
  const days = daysBetween(todayISO(new Date(lastSeenAt)), todayISO(now));
  return days > INACTIVE_AFTER_DAYS ? 'warn' : 'ok';
}
