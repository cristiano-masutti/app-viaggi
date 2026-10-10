import createClient, { type Middleware } from 'openapi-fetch';

import type { paths } from './schema';

/**
 * Errore dell'API nel suo formato unico: `{ error: { code, message, details } }`.
 * `code` decide il messaggio da mostrare; `message` è per i log.
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

export interface ApiClientOptions {
  baseUrl: string;
  /** Il token corrente di Supabase; `null` senza sessione. */
  getAccessToken: () => Promise<string | null>;
  /** Su un 401 la sessione non vale più: si torna al login. */
  onUnauthorized?: () => void;
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

/** Da `{ data, error, response }` di openapi-fetch a "i dati, oppure un `ApiError`". */
export async function unwrap<T>(
  call: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
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

/** I codici dell'API con un messaggio dedicato, nella lingua del pannello. */
const MESSAGES: Record<string, string> = {
  TRIP_FULL: 'Il viaggio è al completo.',
  ALREADY_MEMBER: 'Questa persona è già nel viaggio.',
  LAST_COORDINATOR: 'Il viaggio ha bisogno di almeno un coordinatore: promuovi prima qualcun altro.',
  EMAIL_TAKEN: 'Esiste già un account con questa email.',
  ACCOUNT_PROVIDER_ERROR: "Supabase non ha creato l'account: riprova tra poco.",
  FORBIDDEN: 'Questa area è riservata allo staff.',
  VALIDATION_ERROR: 'Controlla i campi: qualcosa non va.',
  NOT_FOUND: 'Non esiste più: forse è stato appena rimosso.',
  UNSUPPORTED_FILE_TYPE: "Questo tipo di file non è supportato: carica un PDF o un'immagine.",
  PAYLOAD_TOO_LARGE: 'Il file è troppo grande.',
  DOCUMENT_UNAVAILABLE: 'Il documento è già collegato altrove: caricalo di nuovo.',
  DAYS_HAVE_CONTENT: 'Ci sono ancora alloggi, attività o ricordi nei giorni che vuoi togliere.',
  CAPACITY_BELOW_CREW: 'La capienza non può scendere sotto i posti già occupati.',
};

export function errorMessage(error: unknown, fallback = 'Qualcosa è andato storto. Riprova.'): string {
  if (error instanceof ApiError) return MESSAGES[error.code] ?? fallback;
  // Senza rete fetch rifiuta con un TypeError ("Failed to fetch" / "Load failed").
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message)) {
    return 'Nessuna connessione con il server.';
  }
  return fallback;
}
