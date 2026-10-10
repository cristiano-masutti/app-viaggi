import { type Session, type SupabaseClient } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/** Perché l'accesso non è riuscito: decide il messaggio, non il dettaglio tecnico. */
export type SignInFailure = 'invalid_credentials' | 'network' | 'unknown';

export class SignInError extends Error {
  constructor(
    readonly reason: SignInFailure,
    options?: { cause?: unknown },
  ) {
    super(`Sign in failed: ${reason}`, options);
    this.name = 'SignInError';
  }
}

export type AuthState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; email: string | null };

export interface AuthApi {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Il token per il backend, rinnovato da Supabase quando scade. */
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthApi | null>(null);

const stateOf = (session: Session | null): AuthState =>
  session ? { status: 'signedIn', email: session.user.email ?? null } : { status: 'signedOut' };

/**
 * La sessione dello staff: email e password di Supabase Auth, le stesse
 * credenziali dell'app. Chi entra qui ma non è staff lo scopre al primo passo
 * (`AdminGate`), non da questo componente: il ruolo lo decide il backend.
 */
export function AuthProvider({ client, children }: { client: SupabaseClient; children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (active) setState(stateOf(data.session));
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => setState(stateOf(session)));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  // Funzioni stabili: chi le usa (il client dell'API) non si ricrea a ogni cambio di stato.
  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (!error) return;
      if (error.name === 'AuthRetryableFetchError') throw new SignInError('network', { cause: error });
      if (error.status === 400) throw new SignInError('invalid_credentials', { cause: error });
      throw new SignInError('unknown', { cause: error });
    },
    [client],
  );
  const signOut = useCallback(async () => {
    // Anche senza rete la sessione locale sparisce: si esce comunque.
    await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
  }, [client]);
  const getAccessToken = useCallback(
    async () => (await client.auth.getSession()).data.session?.access_token ?? null,
    [client],
  );

  const api = useMemo<AuthApi>(
    () => ({ state, signIn, signOut, getAccessToken }),
    [getAccessToken, signIn, signOut, state],
  );

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthApi {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth va usato dentro <AuthProvider />');
  return auth;
}
