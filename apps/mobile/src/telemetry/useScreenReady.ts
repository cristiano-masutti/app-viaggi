import { useEffect, useRef } from 'react';

import { markAppReady, telemetry } from './index';

/**
 * Quanto ci mette una schermata a mostrare i dati: dal montaggio al primo
 * momento in cui `ready` è vero (lo scheletro lascia il posto al contenuto).
 * Una misura per montaggio.
 */
export function useScreenReady(screen: string, ready: boolean) {
  const mountedAt = useRef(performance.now());
  const reported = useRef(false);

  useEffect(() => {
    if (!ready || reported.current) return;
    reported.current = true;
    telemetry.sample('screen_ready', performance.now() - mountedAt.current, screen);
    markAppReady(screen);
  }, [ready, screen]);
}
