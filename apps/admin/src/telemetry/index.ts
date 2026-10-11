import { onCLS, onINP, onLCP, onTTFB } from 'web-vitals';

import { pagePattern } from './pages';
import { PanelTelemetry } from './PanelTelemetry';

const FLUSH_EVERY_MS = 30_000;

/**
 * Avvia le misure del pannello: Web Vitals della pagina in cui si trova lo
 * staff, invio ogni 30 secondi e quando la scheda va in secondo piano (è lì
 * che arrivano i valori finali di CLS e INP).
 */
export function startPanelTelemetry(telemetry: PanelTelemetry) {
  const page = () => pagePattern(window.location.pathname);
  // Prima i Web Vitals, poi il nostro ascoltatore: alla chiusura i loro valori sono già in coda.
  onLCP((metric) => telemetry.sample('lcp', metric.value, page()));
  onINP((metric) => telemetry.sample('inp', metric.value, page()));
  onCLS((metric) => telemetry.sample('cls', metric.value, page()));
  onTTFB((metric) => telemetry.sample('ttfb', metric.value, page()));

  window.setInterval(() => void telemetry.flush(), FLUSH_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void telemetry.flush();
  });
}

export { PanelTelemetry };
