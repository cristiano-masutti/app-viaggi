import type { SupabaseClient } from '@supabase/supabase-js';
import { vi } from 'vitest';

/**
 * Il minimo di Supabase Auth che il pannello usa, in memoria: una sessione
 * (o nessuna), il login con password e l'uscita.
 */
export function fakeSupabase({
  email = null as string | null,
  password = 'giusta',
}: { email?: string | null; password?: string } = {}) {
  let session = email ? { access_token: 'token-1', user: { email } } : null;
  const listeners = new Set<(event: string, current: typeof session) => void>();
  const emit = () => listeners.forEach((listener) => listener('change', session));

  const auth = {
    getSession: vi.fn(async () => ({ data: { session } })),
    onAuthStateChange: vi.fn((listener: (event: string, current: typeof session) => void) => {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    }),
    signInWithPassword: vi.fn(
      async ({ email: login, password: given }: { email: string; password: string }) => {
        if (given !== password) {
          return {
            error: Object.assign(new Error('Invalid login credentials'), {
              name: 'AuthApiError',
              status: 400,
            }),
          };
        }
        session = { access_token: 'token-1', user: { email: login } };
        emit();
        return { error: null };
      },
    ),
    signOut: vi.fn(async () => {
      session = null;
      emit();
      return { error: null };
    }),
  };
  return { auth } as unknown as SupabaseClient & { auth: typeof auth };
}

/** Un `fetch` che risponde per percorso: `{ 'GET /api/admin/session': [200, {...}] }`. */
export function fakeFetch(routes: Record<string, [number, unknown]>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const { pathname } = new URL(request.url);
    const route = routes[`${request.method} ${pathname}`];
    if (!route)
      return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: pathname } }), {
        status: 404,
      });
    return new Response(JSON.stringify(route[1]), {
      status: route[0],
      headers: { 'content-type': 'application/json' },
    });
  });
}
