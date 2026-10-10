import type { FastifyBaseLogger } from 'fastify';

import type { ObjectStorage } from './storage.js';

/**
 * Cancella dal bucket i file di righe già eliminate dal database. Si chiama
 * dopo il commit: se lo storage fallisce, il file resta orfano (e finisce nei
 * log) ma i dati restano coerenti, mai il contrario.
 */
export async function removeStoredFiles(
  storage: ObjectStorage,
  log: FastifyBaseLogger,
  paths: ReadonlyArray<string | null | undefined>,
) {
  const existing = paths.filter((path): path is string => Boolean(path));
  if (existing.length === 0) return;

  try {
    // Supabase accetta al più 1000 percorsi per chiamata.
    for (let start = 0; start < existing.length; start += 1000) {
      await storage.remove(existing.slice(start, start + 1000));
    }
  } catch (error) {
    log.error({ err: error, paths: existing }, 'Failed to remove stored files: they are now orphaned');
  }
}
