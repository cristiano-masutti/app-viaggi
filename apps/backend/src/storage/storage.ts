/**
 * Archivio dei file caricati dagli utenti.
 *
 * Le route parlano solo con questa interfaccia: in produzione dietro c'è
 * Supabase Storage, nei test un'implementazione in memoria. Il bucket è privato:
 * un file si legge solo tramite un URL firmato e a scadenza.
 */
export interface ObjectStorage {
  upload(path: string, body: Buffer, contentType: string): Promise<void>;
  createSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
  /** Più URL firmati con una sola chiamata: per le liste (es. le foto dei ricordi). */
  createSignedUrls(paths: string[], expiresInSeconds: number): Promise<Map<string, string>>;
  remove(paths: string[]): Promise<void>;
}

/** Lo storage non ha risposto o ha rifiutato l'operazione: per il client è un 502. */
export class StorageError extends Error {
  constructor(
    readonly operation: 'upload' | 'createSignedUrl' | 'createSignedUrls' | 'remove',
    message: string,
    options?: { cause?: unknown },
  ) {
    super(`Storage ${operation} failed: ${message}`, options);
    this.name = 'StorageError';
  }
}
