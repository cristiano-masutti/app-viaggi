import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import type { DocumentRef } from '@/types';

/**
 * Archiviazione offline dei documenti.
 *
 * Regola del prodotto: **un documento del viaggio deve essere leggibile senza
 * rete**. Al gate d'imbarco, in un ostello islandese o in un taxi marocchino la
 * connessione non c'è, ed è esattamente lì che serve il voucher. Per questo il
 * salvataggio non è un'azione che l'utente può dimenticare di fare: appena un
 * documento entra nel viaggio, finisce sul disco del telefono.
 *
 * I file vivono in `documentDirectory/documenti/<id>.<ext>`: una cartella che il
 * sistema non ripulisce da sola (a differenza della cache) e che sparisce solo
 * con l'app. Il percorso è deterministico, quindi **l'indice è il disco stesso**:
 * non serve un registro parallelo da tenere sincronizzato, e lo stato sopravvive
 * ai riavvii per costruzione.
 */

const FOLDER = 'documenti';

/** Su web `expo-file-system` è uno stub: lo stato resta quello di un'anteprima. */
export const OFFLINE_STORAGE_SUPPORTED = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * ⚠️ SHIM DI PROTOTIPO — da rimuovere con il backend reale.
 *
 * Gli URI dei mock puntano a `files.vibemakers.travel`, che non esiste: una
 * `downloadFileAsync` fallirebbe sempre e non si vedrebbe mai lo stato finale.
 * Finché l'endpoint non c'è, per quei soli URI scriviamo un segnaposto vero sul
 * disco — così percorsi, dimensioni, stati e UI girano per davvero.
 *
 * Quando il backend sarà attivo basta cancellare questa costante e il ramo che
 * la usa in `saveForOffline`: il resto del modulo è già il codice definitivo.
 */
const PLACEHOLDER_HOST = 'files.vibemakers.travel';
const SIMULATED_TRANSFER_MS = 420;

export interface StoredDocument {
  /** URI leggibile dal viewer: `file://…` su device. */
  uri: string;
  bytes: number;
}

/** URI già sul dispositivo (rullino, file picker): non c'è niente da scaricare. */
export const isLocalUri = (uri: string) =>
  uri.startsWith('file://') ||
  uri.startsWith('content://') ||
  uri.startsWith('ph://') ||
  uri.startsWith('assets-library://');

const extensionFor = (doc: DocumentRef) => (doc.kind === 'pdf' ? 'pdf' : 'png');

/** FNV-1a a 32 bit: un'impronta corta e stabile, non un hash crittografico. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * La chiave della copia locale: l'id del documento più un'impronta della sua
 * sorgente. Quasi sempre un file nuovo ha anche un id nuovo; la scansione del
 * passaporto no (è una per persona), e cambia solo l'URI, che porta la versione.
 * Così una scansione sostituita si riscarica, e la vecchia diventa un orfano.
 */
export const offlineKey = (doc: DocumentRef) => `${doc.id}-${fingerprint(doc.uri)}`;

const fileNameFor = (doc: DocumentRef) => `${offlineKey(doc)}.${extensionFor(doc)}`;

/** La cartella dei documenti, creata alla prima necessità. */
function documentsFolder(): Directory {
  const folder = new Directory(Paths.document, FOLDER);
  if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
  return folder;
}

function fileFor(doc: DocumentRef): File {
  return new File(documentsFolder(), fileNameFor(doc));
}

/**
 * Il documento è già sul telefono?
 * Ritorna l'URI locale e la dimensione, oppure `null` se va ancora salvato.
 */
export function storedDocument(doc: DocumentRef): StoredDocument | null {
  // Un file scelto dal rullino o dal file picker è già sul dispositivo:
  // ricopiarlo sarebbe solo spazio sprecato.
  if (isLocalUri(doc.uri)) return { uri: doc.uri, bytes: 0 };
  if (!OFFLINE_STORAGE_SUPPORTED) return null;

  try {
    const file = fileFor(doc);
    return file.exists ? { uri: file.uri, bytes: file.size } : null;
  } catch {
    return null;
  }
}

/**
 * Scarica il documento e lo lascia sul disco.
 * Idempotente: se il file c'è già non ritocca nulla.
 */
export async function saveForOffline(
  doc: DocumentRef,
  /**
   * Da riferimento a URL scaricabile: i file del backend (`api:…`) si aprono
   * solo con URL firmati e a scadenza, chiesti al momento del download.
   */
  resolveUrl: (uri: string) => Promise<string> = async (uri) => uri,
): Promise<StoredDocument> {
  // Un QR senza file si disegna dal codice: non c'è niente da portare sul disco.
  if (doc.uri === '') return { uri: '', bytes: 0 };

  const existing = storedDocument(doc);
  if (existing) return existing;

  // Anteprima su web: nessun filesystem, ma la macchina a stati gira lo stesso
  // e la UI dichiara apertamente che il disco è solo su iOS e Android.
  if (!OFFLINE_STORAGE_SUPPORTED) {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_TRANSFER_MS));
    return { uri: await resolveUrl(doc.uri), bytes: 0 };
  }

  const file = fileFor(doc);

  // ⚠️ SHIM DI PROTOTIPO — vedi PLACEHOLDER_HOST.
  if (doc.uri.includes(PLACEHOLDER_HOST)) {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_TRANSFER_MS));
    file.create({ overwrite: true });
    file.write(`segnaposto offline · ${doc.code} · ${doc.title}`);
    return { uri: file.uri, bytes: file.size };
  }

  const downloaded = await File.downloadFileAsync(await resolveUrl(doc.uri), file, { idempotent: true });
  return { uri: downloaded.uri, bytes: downloaded.size };
}

/** Rimuove la copia locale (usata quando il documento viene sostituito o cancellato). */
export function removeOffline(doc: DocumentRef): void {
  if (!OFFLINE_STORAGE_SUPPORTED || isLocalUri(doc.uri)) return;
  try {
    const file = fileFor(doc);
    if (file.exists) file.delete();
  } catch {
    /* il file non c'è più: va bene così */
  }
}

/**
 * Toglie dal disco la copia di un documento. Serve a un download finito dopo
 * il logout: il file appena scritto è dell'account che è uscito.
 */
export function discardStoredDocument(doc: DocumentRef): void {
  if (!OFFLINE_STORAGE_SUPPORTED) return;
  try {
    const file = fileFor(doc);
    if (file.exists) file.delete();
  } catch {
    // Se non si cancella ora, lo toglie la prossima pulizia degli orfani.
  }
}

/**
 * Cancella le copie locali che non corrispondono più a nessun documento.
 *
 * Senza questo passaggio ogni voucher sostituito lascerebbe il suo file sul
 * telefono per sempre: dopo qualche viaggio sarebbero centinaia di megabyte che
 * l'utente non sa di avere e non può cancellare da nessuna parte.
 *
 * Il nome del file è `<offlineKey>.<ext>`, quindi basta confrontare i nomi con
 * i documenti ancora vivi: nessun registro da tenere allineato.
 */
export function pruneOrphans(documents: DocumentRef[]): number {
  if (!OFFLINE_STORAGE_SUPPORTED) return 0;

  try {
    const valid = new Set(documents.map(offlineKey));
    let removed = 0;
    documentsFolder()
      .list()
      .forEach((entry) => {
        if (!(entry instanceof File)) return;
        const key = entry.name.replace(/\.[^.]+$/, '');
        if (valid.has(key)) return;
        entry.delete();
        removed += 1;
      });
    return removed;
  } catch {
    return 0;
  }
}

/** Spazio occupato dai documenti salvati, per la riga di stato. */
export function offlineFootprint(): number {
  if (!OFFLINE_STORAGE_SUPPORTED) return 0;
  try {
    return documentsFolder()
      .list()
      .reduce((total, entry) => total + (entry instanceof File ? entry.size : 0), 0);
  } catch {
    return 0;
  }
}

/** '1,2 MB' — la dimensione come la scriverebbe il sistema operativo. */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 KB';
  const mb = bytes / 1_048_576;
  if (mb >= 1) return `${mb.toFixed(1).replace('.', ',')} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
