import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';

import { dataMode, type DataMode } from '@/config';

import { supabase } from './supabase';

/** Perché il login non è andato: decide il messaggio, non il dettaglio tecnico. */
export type AuthFailure = 'invalid_credentials' | 'network' | 'unknown';

export class AuthError extends Error {
  constructor(readonly reason: AuthFailure, options?: { cause?: unknown }) {
    super(`Sign in failed: ${reason}`, options);
    this.name = 'AuthError';
  }
}

export interface AuthApi {
  mode: DataMode;
  /** Etichetta del campo identificativo nel login. */
  identifierLabel: 'Email' | 'Nome utente';
  /** C'è una sessione salvata sul telefono: abilita lo Sblocco Rapido. */
  hasSavedSession: () => Promise<boolean>;
  signIn: (identifier: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Il token per il backend, rinnovato da Supabase quando scade; `null` senza sessione. */
  getAccessToken: () => Promise<string | null>;
}

/** Prototipo: qualunque credenziale va bene, la "sessione" è un segnaposto. */
const MOCK_SESSION_KEY = 'vibemakers.session';

const mockAuth: AuthApi = {
  mode: 'mock',
  identifierLabel: 'Nome utente',
  hasSavedSession: async () => !!(await SecureStore.getItemAsync(MOCK_SESSION_KEY).catch(() => null)),
  signIn: async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await SecureStore.setItemAsync(MOCK_SESSION_KEY, 'token-placeholder').catch(() => null);
  },
  signOut: async () => {},
  getAccessToken: async () => null,
};

function remoteAuth(client: NonNullable<typeof supabase>): AuthApi {
  return {
    mode: 'remote',
    identifierLabel: 'Email',
    hasSavedSession: async () => !!(await client.auth.getSession()).data.session,
    signIn: async (email, password) => {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return;
      if (error.name === 'AuthRetryableFetchError') throw new AuthError('network', { cause: error });
      if (error.status === 400) throw new AuthError('invalid_credentials', { cause: error });
      throw new AuthError('unknown', { cause: error });
    },
    signOut: async () => {
      // Anche se la rete non c'è, la sessione locale sparisce: si esce comunque.
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },
    getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
  };
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useMemo(() => (dataMode === 'remote' && supabase ? remoteAuth(supabase) : mockAuth), []);

  // Supabase rinnova il token da solo, ma su mobile va fermato in background e
  // ripreso al ritorno: è la raccomandazione per React Native.
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
    return () => subscription.remove();
  }, []);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth va usato dentro <AuthProvider />');
  return auth;
}
