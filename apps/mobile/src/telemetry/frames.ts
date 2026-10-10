/**
 * Fluidità: quanto il thread JavaScript riesce a stare al passo con lo schermo.
 *
 * Si misura con `requestAnimationFrame`: tra un fotogramma e l'altro dovrebbero
 * passare ~16 ms. Un intervallo oltre i 34 ms vuol dire almeno un fotogramma
 * saltato (scatto); oltre i 700 ms l'app sembra bloccata. La misura gira a
 * finestre di 10 secondi una volta al minuto, non sempre: il monitor stesso non
 * deve pesare sulla batteria.
 */

export const SLOW_FRAME_MS = 34;
export const FROZEN_FRAME_MS = 700;

export interface FrameWindow {
  frames: number;
  /** Fotogrammi lenti sul totale, in percentuale. */
  slowPercent: number;
  /** Blocchi oltre i 700 ms. */
  frozen: number;
}

/** Dagli intervalli fra fotogrammi alla finestra da riportare; `null` se troppo pochi per dire qualcosa. */
export function summarizeFrames(intervals: number[]): FrameWindow | null {
  if (intervals.length < 30) return null;
  const slow = intervals.filter((interval) => interval > SLOW_FRAME_MS).length;
  const frozen = intervals.filter((interval) => interval > FROZEN_FRAME_MS).length;
  return { frames: intervals.length, slowPercent: Math.round((slow / intervals.length) * 1000) / 10, frozen };
}

export interface FrameSamplerOptions {
  windowMs?: number;
  everyMs?: number;
  onWindow: (window: FrameWindow) => void;
  raf?: (callback: (time: number) => void) => number;
  cancelRaf?: (handle: number) => void;
  setTimer?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}

/** Avvia il campionamento; restituisce la funzione che lo ferma (app in background, logout). */
export function startFrameSampler({
  windowMs = 10_000,
  everyMs = 60_000,
  onWindow,
  raf = requestAnimationFrame,
  cancelRaf = cancelAnimationFrame,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}: FrameSamplerOptions): () => void {
  let frame: number | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const measure = () => {
    const intervals: number[] = [];
    let last: number | null = null;
    let startedAt: number | null = null;

    const tick = (time: number) => {
      if (stopped) return;
      if (last !== null) intervals.push(time - last);
      startedAt ??= time;
      last = time;
      if (time - startedAt < windowMs) {
        frame = raf(tick);
        return;
      }
      frame = null;
      const window = summarizeFrames(intervals);
      if (window) onWindow(window);
      timer = setTimer(measure, everyMs - windowMs);
    };
    frame = raf(tick);
  };

  measure();
  return () => {
    stopped = true;
    if (frame !== null) cancelRaf(frame);
    if (timer !== null) clearTimer(timer);
  };
}
