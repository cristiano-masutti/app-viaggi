import * as SecureStore from 'expo-secure-store';

import type { UserProfile } from '@/types';

/**
 * Le impostazioni che restano sul telefono: lo sblocco biometrico vale per il
 * device, non per l'account; l'avatar non è ancora sul backend. Sono separate
 * per utente: chi accede dopo un altro sullo stesso telefono non eredita nulla.
 */
export type LocalPrefs = Pick<UserProfile, 'avatar' | 'biometricUnlock'>;

export interface LocalPrefsStore {
  load: (userId: string) => Promise<LocalPrefs>;
  save: (userId: string, prefs: LocalPrefs) => Promise<void>;
}

// SecureStore accetta solo lettere, cifre, '.', '-' e '_': l'id è un UUID.
const keyOf = (userId: string) => `vibemakers.prefs.${userId}`;
const DEFAULTS: LocalPrefs = { avatar: '', biometricUnlock: false };

export const secureLocalPrefs: LocalPrefsStore = {
  load: async (userId) => {
    try {
      const raw = await SecureStore.getItemAsync(keyOf(userId));
      return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<LocalPrefs>) } : DEFAULTS;
    } catch {
      return DEFAULTS;
    }
  },
  save: async (userId, prefs) => {
    await SecureStore.setItemAsync(keyOf(userId), JSON.stringify(prefs)).catch(() => undefined);
  },
};
