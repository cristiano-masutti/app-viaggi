import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { dataMode } from '@/config';

import { Telemetry } from './Telemetry';

/**
 * L'istanza dell'app. Si importa per prima (da `index.ts` della radice): il
 * momento del primo import è la base del tempo di avvio.
 */
export const APP_STARTED_AT = performance.now();

export const telemetry = new Telemetry({
  enabled: dataMode === 'remote',
  platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
  appVersion: Constants.expoConfig?.version,
});

/** La schermata in primo piano: dà il nome alle misure di fluidità. */
export const currentScreen = { name: 'Login' };

/** La prima schermata pronta chiude il tempo di avvio. */
export function markAppReady(screen: string) {
  telemetry.sampleOnce('app_start', 'app_start', performance.now() - APP_STARTED_AT, screen);
}

export type { EventName, Metric } from './Telemetry';
