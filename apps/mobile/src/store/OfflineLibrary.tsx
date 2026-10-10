import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  discardStoredDocument,
  OFFLINE_STORAGE_SUPPORTED,
  offlineKey,
  pruneOrphans,
  saveForOffline,
  storedDocument,
  type StoredDocument,
} from '@/lib/offlineDocuments';
import { PROFILE_PASSPORT_DOC_ID } from '@/lib/documentIds';
import { useAppState, useFileUrlResolver } from '@/store/AppStore';
import type { DocumentRef, Trip } from '@/types';

/**
 * Biblioteca offline.
 *
 * Non esiste un tasto "Salva offline": ogni documento che entra in un viaggio
 * viene messo in coda e scritto sul telefono da solo. L'utente non deve
 * ricordarsi di farlo prima di partire — se ne accorgerebbe solo quando la rete
 * non c'è più, cioè troppo tardi.
 *
 * Questo provider osserva i documenti presenti nello stato, li confronta con
 * quelli già sul disco e scarica il resto con una coda a concorrenza limitata:
 * tre trasferimenti insieme bastano a essere veloci senza intasare la rete di
 * un ostello.
 */

export type OfflineState = 'queued' | 'saving' | 'saved' | 'failed';

export interface OfflineEntry {
  state: OfflineState;
  /** URI locale da passare al viewer quando `state === 'saved'`. */
  localUri?: string;
  bytes?: number;
}

interface OfflineSummary {
  total: number;
  saved: number;
  pending: number;
  failed: number;
  bytes: number;
  /** Tutti i documenti sono sul telefono. */
  complete: boolean;
}

interface OfflineLibraryApi {
  entries: Record<string, OfflineEntry>;
  summary: OfflineSummary;
  /** `false` su web: lì il filesystem non esiste e lo stato è solo un'anteprima. */
  supported: boolean;
  retryFailed: () => void;
}

const OfflineLibraryContext = createContext<OfflineLibraryApi | null>(null);

/** Quanti trasferimenti in parallelo. Oltre tre si contendono la stessa linea. */
const CONCURRENCY = 3;

/** Tutti i documenti di un viaggio, giorno per giorno e poi quelli fissi. */
export function collectTripDocuments(trip: Trip): DocumentRef[] {
  const docs: DocumentRef[] = [];

  trip.days.forEach((day) => {
    if (day.stay?.doc) docs.push(day.stay.doc);
    day.activities.forEach((activity) => {
      if (activity.doc) docs.push(activity.doc);
    });
  });

  const { passport, customs, transports, insurance } = trip.documents;
  if (passport?.doc) docs.push(passport.doc);
  if (customs?.doc) docs.push(customs.doc);
  if (insurance?.doc) docs.push(insurance.doc);
  transports.forEach((transport) => {
    transport.docs.forEach((entry) => {
      if (entry.doc) docs.push(entry.doc);
    });
  });

  return docs;
}

export { PROFILE_PASSPORT_DOC_ID };

export function OfflineLibraryProvider({ children }: { children: React.ReactNode }) {
  const { trips, profile, authenticated } = useAppState();
  const resolveFileUrl = useFileUrlResolver();
  const [entries, setEntries] = useState<Record<string, OfflineEntry>>({});

  /**
   * Tutti i documenti che devono stare sul telefono.
   *
   * Lo stesso voucher può comparire in più giorni (l'hotel di due notti): si
   * deduplica per id, così si scarica una volta sola.
   */
  const documents = useMemo(() => {
    // Senza un account aperto non si scarica niente.
    if (!authenticated) return [];
    const byId = new Map<string, DocumentRef>();

    trips.forEach((trip) => {
      collectTripDocuments(trip).forEach((doc) => byId.set(doc.id, doc));
    });

    // Il Passaporto Master del profilo viaggia con l'utente, non con il viaggio:
    // entra nella stessa biblioteca perché serve agli stessi controlli.
    if (profile.passport.photoUri) {
      byId.set(PROFILE_PASSPORT_DOC_ID, {
        id: PROFILE_PASSPORT_DOC_ID,
        kind: 'image',
        title: 'Passaporto (scansione)',
        subtitle: 'Pagina dati del Passaporto Master',
        code: profile.passport.number,
        uri: profile.passport.photoUri,
      });
    }

    return [...byId.values()];
  }, [authenticated, profile.passport.number, profile.passport.photoUri, trips]);

  /**
   * Documenti già presi in carico (per `offlineKey`: un file sostituito sotto
   * lo stesso id è un documento nuovo): evita che l'effetto riaccodi a ogni render.
   */
  const handled = useRef(new Set<string>());
  const queue = useRef<DocumentRef[]>([]);
  const running = useRef(0);
  /** Cambia a ogni uscita dall'account: i download partiti prima non contano più. */
  const generation = useRef(0);

  const pump = useCallback(() => {
    while (running.current < CONCURRENCY && queue.current.length > 0) {
      const doc = queue.current.shift();
      if (!doc) break;

      running.current += 1;
      const started = generation.current;
      setEntries((previous) => ({ ...previous, [doc.id]: { state: 'saving' } }));

      saveForOffline(doc, resolveFileUrl)
        .then((stored: StoredDocument) => {
          if (generation.current !== started) {
            // Finito dopo il logout: il file è dell'account uscito e non deve restare.
            discardStoredDocument(doc);
            return;
          }
          setEntries((previous) => ({
            ...previous,
            [doc.id]: { state: 'saved', localUri: stored.uri, bytes: stored.bytes },
          }));
        })
        .catch(() => {
          if (generation.current !== started) return;
          // Un fallimento non è definitivo: resta visibile e riprovabile.
          handled.current.delete(offlineKey(doc));
          setEntries((previous) => ({ ...previous, [doc.id]: { state: 'failed' } }));
        })
        .finally(() => {
          running.current -= 1;
          pump();
        });
    }
  }, [resolveFileUrl]);

  /**
   * All'uscita dall'account (logout o sessione scaduta) sul telefono non resta
   * niente: coda svuotata, download in corso ignorati, file cancellati. È ciò
   * che promette la conferma "Esci". Non all'avvio dell'app, però: lì si parte
   * sempre dal login, e i documenti salvati devono esserci ancora dopo.
   */
  const wasAuthenticated = useRef(authenticated);
  useEffect(() => {
    const signedOut = wasAuthenticated.current && !authenticated;
    wasAuthenticated.current = authenticated;
    if (!signedOut) return;

    generation.current += 1;
    queue.current = [];
    handled.current.clear();
    setEntries({});
    pruneOrphans([]);
  }, [authenticated]);

  useEffect(() => {
    if (documents.length === 0) return;

    // Prima si fa pulizia: un voucher sostituito non deve lasciare in giro la
    // copia vecchia. Va fatto anche quando non c'è niente di nuovo da scaricare,
    // perché "documento rimosso" è esattamente quel caso.
    pruneOrphans(documents);

    const fresh = documents.filter((doc) => !handled.current.has(offlineKey(doc)));
    if (fresh.length === 0) return;

    const alreadyOnDisk: Record<string, OfflineEntry> = {};
    const toDownload: DocumentRef[] = [];

    fresh.forEach((doc) => {
      handled.current.add(offlineKey(doc));
      // Il disco è l'indice: se il file c'è già, lo stato è noto senza rete.
      const stored = storedDocument(doc);
      if (stored) alreadyOnDisk[doc.id] = { state: 'saved', localUri: stored.uri, bytes: stored.bytes };
      else toDownload.push(doc);
    });

    if (Object.keys(alreadyOnDisk).length > 0) {
      setEntries((previous) => ({ ...previous, ...alreadyOnDisk }));
    }

    if (toDownload.length > 0) {
      setEntries((previous) => {
        const next = { ...previous };
        toDownload.forEach((doc) => {
          next[doc.id] = { state: 'queued' };
        });
        return next;
      });
      queue.current.push(...toDownload);
      pump();
    }
  }, [documents, pump]);

  const retryFailed = useCallback(() => {
    const failed = documents.filter((doc) => entries[doc.id]?.state === 'failed');
    if (failed.length === 0) return;

    failed.forEach((doc) => handled.current.add(offlineKey(doc)));
    setEntries((previous) => {
      const next = { ...previous };
      failed.forEach((doc) => {
        next[doc.id] = { state: 'queued' };
      });
      return next;
    });
    queue.current.push(...failed);
    pump();
  }, [documents, entries, pump]);

  const summary = useMemo<OfflineSummary>(() => {
    let saved = 0;
    let failed = 0;
    let bytes = 0;

    documents.forEach((doc) => {
      const entry = entries[doc.id];
      if (entry?.state === 'saved') {
        saved += 1;
        bytes += entry.bytes ?? 0;
      } else if (entry?.state === 'failed') {
        failed += 1;
      }
    });

    const total = documents.length;
    return {
      total,
      saved,
      failed,
      pending: total - saved - failed,
      bytes,
      complete: total > 0 && saved === total,
    };
  }, [documents, entries]);

  const value = useMemo<OfflineLibraryApi>(
    () => ({ entries, summary, supported: OFFLINE_STORAGE_SUPPORTED, retryFailed }),
    [entries, retryFailed, summary],
  );

  return <OfflineLibraryContext.Provider value={value}>{children}</OfflineLibraryContext.Provider>;
}

function useOfflineLibrary(): OfflineLibraryApi {
  const api = useContext(OfflineLibraryContext);
  if (!api) throw new Error('useOfflineLibrary va usato dentro <OfflineLibraryProvider />');
  return api;
}

/** Stato offline di un singolo documento. */
export function useOfflineDocument(docId: string | undefined): OfflineEntry {
  const { entries } = useOfflineLibrary();
  return (docId ? entries[docId] : undefined) ?? { state: 'queued' };
}

/**
 * Stato della biblioteca limitato a un viaggio: è quello che interessa mentre
 * si sta dentro quel viaggio, non il totale dell'app.
 */
export function useTripOfflineStatus(trip: Trip) {
  const { entries, supported, retryFailed } = useOfflineLibrary();

  return useMemo(() => {
    const ids = new Set(collectTripDocuments(trip).map((doc) => doc.id));
    let saved = 0;
    let failed = 0;
    let bytes = 0;

    ids.forEach((id) => {
      const entry = entries[id];
      if (entry?.state === 'saved') {
        saved += 1;
        bytes += entry.bytes ?? 0;
      } else if (entry?.state === 'failed') {
        failed += 1;
      }
    });

    const total = ids.size;
    return {
      total,
      saved,
      failed,
      pending: total - saved - failed,
      bytes,
      complete: total > 0 && saved === total,
      supported,
      retryFailed,
    };
  }, [entries, retryFailed, supported, trip]);
}

/** Serve al viewer: se il documento è sul telefono lo apre da lì, non dalla rete. */
export function useDocumentSource(doc: DocumentRef | null) {
  const entry = useOfflineDocument(doc?.id);
  return {
    uri: entry.state === 'saved' && entry.localUri ? entry.localUri : doc?.uri,
    entry,
  };
}

export { useOfflineLibrary };
