import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAppState } from '@/store/AppStore';

import { startFrameSampler } from './frames';
import { currentScreen, telemetry } from './index';

const FLUSH_EVERY_MS = 30_000;

/**
 * Il motore delle metriche, senza interfaccia: apre la sessione d'uso, invia
 * a lotti, misura la fluidità mentre l'app è in primo piano e la ferma in
 * background. Nel prototipo non fa niente.
 */
export function TelemetryRuntime() {
  const { authenticated } = useAppState();
  const wasAuthenticated = useRef(false);

  // Entrare è un'apertura dell'app; uscire porta via gli eventi della persona.
  useEffect(() => {
    if (!telemetry.enabled) return;
    if (authenticated && !wasAuthenticated.current) telemetry.event('app_open');
    if (!authenticated && wasAuthenticated.current) telemetry.forgetPerson();
    wasAuthenticated.current = authenticated;
  }, [authenticated]);

  useEffect(() => {
    if (!telemetry.enabled || !authenticated) return;

    let stopFrames = startSampling();
    let previous = AppState.currentState;
    const timer = setInterval(() => void telemetry.flush(), FLUSH_EVERY_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      // Su iOS il centro notifiche o una chiamata passano per `inactive`: non è una nuova apertura.
      const fromBackground = previous === 'background';
      previous = state;
      if (state === 'active') {
        if (fromBackground) telemetry.event('app_open');
        stopFrames ??= startSampling();
      } else {
        // In background si manda subito: il sistema potrebbe chiudere l'app.
        void telemetry.flush();
        stopFrames?.();
        stopFrames = null;
      }
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
      stopFrames?.();
      void telemetry.flush();
    };
  }, [authenticated]);

  return null;
}

function startSampling(): (() => void) | null {
  return startFrameSampler({
    onWindow: ({ slowPercent, frozen }) => {
      telemetry.sample('slow_frames', slowPercent, currentScreen.name);
      telemetry.sample('frozen_frames', frozen, currentScreen.name);
    },
  });
}
