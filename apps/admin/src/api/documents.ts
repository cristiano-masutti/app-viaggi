import { ApiError } from './client';

/**
 * Cosa fare del documento di uno slot quando si salva: tenerlo com'è,
 * staccarlo, oppure caricare un file nuovo e collegare quello.
 */
export type DocumentChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'upload'; file: File };

export const KEEP: DocumentChange = { kind: 'keep' };

/** I tipi che il backend accetta (lo verifica comunque dal contenuto). */
export const ACCEPTED_FILES = 'application/pdf,image/jpeg,image/png,image/webp';

interface UploadOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  /** Come nel client tipizzato: un 401 chiude la sessione e riporta al login. */
  onUnauthorized?: () => void;
  fetch?: typeof globalThis.fetch;
}

/** Carica un file fra i documenti del viaggio (multipart) e ne restituisce l'id. */
export async function uploadDocument(
  { baseUrl, getAccessToken, onUnauthorized, fetch = globalThis.fetch }: UploadOptions,
  tripId: string,
  file: File,
  title: string,
): Promise<string> {
  const form = new FormData();
  form.append('title', title);
  form.append('subtitle', file.name);
  form.append('file', file, file.name);

  const token = await getAccessToken();
  const response = await fetch(`${baseUrl}/api/trips/${tripId}/documents`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (response.status === 401) onUnauthorized?.();
  const payload = (await response.json().catch(() => ({}))) as {
    document?: { id: string };
    error?: { code?: string; message?: string };
  };
  if (!response.ok || !payload.document) {
    throw new ApiError(
      response.status,
      payload.error?.code ?? 'UNKNOWN_ERROR',
      payload.error?.message ?? `Upload failed with status ${response.status}`,
    );
  }
  return payload.document.id;
}

/**
 * Il valore di `documentId` nel body dello slot: `undefined` lascia il
 * documento com'è, `null` lo stacca, un id collega quello appena caricato.
 */
export async function resolveDocumentId(
  change: DocumentChange,
  upload: (file: File) => Promise<string>,
): Promise<string | null | undefined> {
  if (change.kind === 'keep') return undefined;
  if (change.kind === 'remove') return null;
  return upload(change.file);
}
