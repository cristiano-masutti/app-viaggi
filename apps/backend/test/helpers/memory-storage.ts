import { type ObjectStorage, StorageError } from '../../src/storage/storage.js';

type Operation = StorageError['operation'];

interface StoredObject {
  body: Buffer;
  contentType: string;
}

/**
 * Storage finto per i test: tiene i file in una mappa e permette di simulare
 * i guasti di Supabase (`failNext`) o di eseguire codice a metà upload
 * (`onUpload`), per provare i percorsi d'errore senza rete.
 */
export class InMemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, StoredObject>();
  private readonly failures = new Set<Operation>();
  onUpload?: (path: string) => Promise<void>;

  failNext(operation: Operation) {
    this.failures.add(operation);
  }

  private maybeFail(operation: Operation) {
    if (this.failures.delete(operation)) throw new StorageError(operation, 'simulated failure');
  }

  async upload(path: string, body: Buffer, contentType: string) {
    this.maybeFail('upload');
    if (this.objects.has(path)) throw new StorageError('upload', 'object already exists');
    this.objects.set(path, { body, contentType });
    await this.onUpload?.(path);
  }

  async createSignedUrl(path: string, expiresInSeconds: number) {
    this.maybeFail('createSignedUrl');
    if (!this.objects.has(path)) throw new StorageError('createSignedUrl', 'object not found');
    return `https://storage.test/signed/${encodeURIComponent(path)}?expiresIn=${expiresInSeconds}`;
  }

  async createSignedUrls(paths: string[], expiresInSeconds: number) {
    this.maybeFail('createSignedUrls');
    const urls = new Map<string, string>();
    for (const path of paths) {
      if (this.objects.has(path)) urls.set(path, await this.createSignedUrl(path, expiresInSeconds));
    }
    return urls;
  }

  async remove(paths: string[]) {
    this.maybeFail('remove');
    for (const path of paths) this.objects.delete(path);
  }
}
