import type { Page, Request } from '@playwright/test';

/**
 * Velocità e fluidità, misurate nel browser durante gli smoke test.
 *
 * I limiti sono quelli oltre cui la pagina Prestazioni del pannello dice
 * "Scarso" (apps/admin/src/lib/metrics.ts): se un cambiamento porta l'app o
 * il pannello lì, anche su un computer della CI, la CI diventa rossa.
 */
export const BUDGETS = {
  /** Dall'avvio del codice alla prima schermata pronta (ms). */
  appStart: 4000,
  /** Da quando si apre una schermata a quando mostra i dati (ms). */
  screenReady: 2500,
  /** p95 delle chiamate all'API viste dal client (ms). */
  apiLatencyP95: 1000,
  /** Fotogrammi oltre 34 ms mentre si scorre (%). */
  slowFramesPercent: 15,
  /** Un fotogramma oltre 700 ms è un blocco: l'app si pianta. */
  frozenFrameMs: 700,
  /** Pannello, Web Vitals. */
  lcp: 4000,
  cls: 0.25,
  inp: 500,
} as const;

/** Un telefono di fascia media: la CPU del computer, rallentata. */
export async function throttleCpu(page: Page, rate = 4) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
}

export const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
};

/**
 * Scorre l'elenco più lungo della pagina per `durationMs`, un passo per
 * fotogramma, e misura quanto dura ogni fotogramma.
 */
export async function measureScroll(page: Page, durationMs = 2000) {
  const frames = await page.evaluate(
    (duration) =>
      new Promise<number[]>((resolve, reject) => {
        const scrollers = [...document.querySelectorAll<HTMLElement>('*')].filter((element) => {
          const { overflowY } = getComputedStyle(element);
          return (
            (overflowY === 'auto' || overflowY === 'scroll') &&
            element.scrollHeight > element.clientHeight + 200
          );
        });
        const target = scrollers.sort(
          (a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight),
        )[0];
        if (!target) return reject(new Error('Niente da scorrere nella pagina'));
        const distance = target.scrollHeight - target.clientHeight;
        const durations: number[] = [];
        let start = 0;
        let last = 0;
        const step = (now: number) => {
          if (!start) start = last = now;
          else durations.push(now - last);
          last = now;
          const progress = Math.min(1, (now - start) / duration);
          target.scrollTop = distance * progress;
          if (progress < 1) requestAnimationFrame(step);
          else resolve(durations);
        };
        requestAnimationFrame(step);
      }),
    durationMs,
  );
  const slow = frames.filter((frame) => frame > 34).length;
  return {
    frames: frames.length,
    slowPercent: frames.length ? (slow / frames.length) * 100 : 0,
    longestFrame: Math.max(0, ...frames),
  };
}

/** I compiti lunghi del thread principale (oltre 50 ms): il tempo in cui la pagina non risponde. */
export async function watchLongTasks(page: Page) {
  await page.addInitScript(() => {
    const tasks: number[] = [];
    (window as unknown as { __e2eLongTasks: number[] }).__e2eLongTasks = tasks;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) tasks.push(entry.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
}

export async function blockingTime(page: Page) {
  const tasks = await page.evaluate(() => (window as unknown as { __e2eLongTasks: number[] }).__e2eLongTasks);
  return {
    totalBlockingMs: tasks.reduce((sum, task) => sum + Math.max(0, task - 50), 0),
    longest: Math.max(0, ...tasks),
  };
}

/** LCP e CLS della pagina, letti con gli stessi osservatori che usa la libreria web-vitals. */
export async function webVitals(page: Page) {
  return page.evaluate(
    () =>
      new Promise<{ lcp: number; cls: number }>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = Math.max(lcp, entry.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<
            PerformanceEntry & { value: number; hadRecentInput: boolean }
          >)
            if (!entry.hadRecentInput) cls += entry.value;
        }).observe({ type: 'layout-shift', buffered: true });
        setTimeout(() => resolve({ lcp, cls }), 300);
      }),
  );
}

/** La durata più lunga fra le interazioni (clic, tasti) finora: l'INP del laboratorio. */
export async function watchInteractions(page: Page) {
  await page.addInitScript(() => {
    const durations: number[] = [];
    (window as unknown as { __e2eInteractions: number[] }).__e2eInteractions = durations;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { interactionId?: number }>)
        if (entry.interactionId) durations.push(entry.duration);
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  });
}

export async function slowestInteraction(page: Page) {
  const durations = await page.evaluate(
    () => (window as unknown as { __e2eInteractions: number[] }).__e2eInteractions,
  );
  return Math.max(0, ...durations);
}

export interface TelemetryUpload {
  source: 'app' | 'panel';
  events: Array<{ name: string; screen?: string; tripId?: string }>;
  samples: Array<{ metric: string; value: number; target?: string }>;
  status: number;
}

/** Quello che il frontend manda davvero a `POST /api/telemetry`, con la risposta del backend. */
export function recordTelemetry(page: Page) {
  const uploads: TelemetryUpload[] = [];
  page.on('requestfinished', async (request: Request) => {
    if (!request.url().endsWith('/api/telemetry') || request.method() !== 'POST') return;
    const response = await request.response();
    uploads.push({
      ...(request.postDataJSON() as Omit<TelemetryUpload, 'status'>),
      status: response?.status() ?? 0,
    });
  });
  return {
    uploads,
    events: () => uploads.flatMap((upload) => upload.events),
    samples: (metric?: string) =>
      uploads.flatMap((upload) => upload.samples).filter((sample) => !metric || sample.metric === metric),
  };
}

/** Come quando si cambia app o si chiude la scheda: i frontend mandano subito quello che hanno. */
export async function sendToBackground(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}
