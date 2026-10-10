import createClient, { type Middleware } from 'openapi-fetch';

import type { paths } from './schema';

/**
 * Errore dell'API nel suo formato unico: `{ error: { code, message, details } }`.
 * `code` è stabile e serve a decidere cosa mostrare; `message` è per i log.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiClientOptions {
  baseUrl: string;
  /** Il token corrente di Supabase; `null` se l'utente non ha una sessione. */
  getAccessToken: () => Promise<string | null>;
  /** Chiamata su un 401: la sessione non vale più, si torna al login. */
  onUnauthorized?: () => void;
  /** Sostituibile nei test. */
  fetch?: typeof globalThis.fetch;
}

export function createApiClient({ baseUrl, getAccessToken, onUnauthorized, fetch }: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl, fetch });

  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await getAccessToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) onUnauthorized?.();
      return response;
    },
  };
  client.use(auth);

  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown };
}

/**
 * Da `{ data, error, response }` di openapi-fetch a "i dati, oppure un
 * `ApiError`": le chiamate dello store restano lineari.
 */
export async function unwrap<T>(call: Promise<{ data?: T; error?: unknown; response: Response }>): Promise<T> {
  const { data, error, response } = await call;
  if (response.ok) return data as T;

  const envelope = (error ?? {}) as ErrorEnvelope;
  throw new ApiError(
    response.status,
    envelope.error?.code ?? 'UNKNOWN_ERROR',
    envelope.error?.message ?? `Request failed with status ${response.status}`,
    envelope.error?.details,
  );
}
