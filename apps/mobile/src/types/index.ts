/**
 * Modello dati del prototipo.
 *
 * È il contratto che sta in mezzo tra i mock (`src/mock`) e i componenti: quando
 * arriverà il backend basterà sostituire la sorgente dentro `AppStore`, le
 * schermate non cambiano.
 */

/* ── Viaggio ─────────────────────────────────────────────────────────── */

/** I tre segmenti dell'hub "I Miei Viaggi". */
export type TripStatus = 'ongoing' | 'upcoming' | 'past';

/** Identificativo di tappa: 'G1', 'G2', … Un viaggio non ha orari, solo giorni. */
export type DayId = string;

export type CrewRole = 'coordinator' | 'traveller';

export interface CrewMember {
  id: string;
  name: string;
  /** @handle o email con cui è stato invitato. */
  handle: string;
  avatar?: string;
  role: CrewRole;
  /** `false` = invito spedito ma non ancora accettato. */
  confirmed: boolean;
}

/* ── Documenti ───────────────────────────────────────────────────────── */

/**
 * Un QR o un PDF non viene mai renderizzato in linea: la card mostra solo il
 * tasto, il contenuto compare nel viewer a schermo intero ("Tap per Visualizzare").
 */
export type DocumentKind = 'pdf' | 'qr' | 'image';

export interface DocumentRef {
  id: string;
  kind: DocumentKind;
  title: string;
  subtitle: string;
  /** Codice pratica mostrato nel viewer (voucher, biglietto, polizza…). */
  code: string;
  uri: string;
}

/* ── Programma del giorno ────────────────────────────────────────────── */

export interface Stay {
  name: string;
  address: string;
  doc: DocumentRef | null;
}

export interface Activity {
  id: string;
  name: string;
  place: string;
  doc: DocumentRef | null;
}

export interface TripDay {
  id: DayId;
  /** 1-based: serve per "Giorno 3 di 10" e per ordinare. */
  index: number;
  /** Etichetta breve del filtro: 'G3'. */
  label: string;
  /** Data leggibile: '16 Set'. */
  date: string;
  /** `null` finché il coordinatore non lo imposta → placeholder tratteggiato. */
  stay: Stay | null;
  activities: Activity[];
}

/* ── Documenti fissi del viaggio ─────────────────────────────────────── */

export type TransportMode = 'van' | 'flight' | 'ferry';

export interface TransportDoc {
  id: string;
  label: string;
  doc: DocumentRef | null;
}

export interface Transport {
  id: string;
  name: string;
  /** Riferimento sintetico: targa, numero volo, molo e orario. */
  reference: string;
  mode: TransportMode;
  docs: TransportDoc[];
}

/**
 * In tutti questi blocchi `doc` è opzionale: i dati possono essere compilati
 * prima che il file esista (numero di polizza scritto oggi, certificato
 * allegato domani). La UI distingue i due stati con lo stesso tasto.
 */
export interface PassportInfo {
  number: string;
  expiry: string;
  doc: DocumentRef | null;
}

export interface CustomsInfo {
  code: string;
  note: string;
  doc: DocumentRef | null;
}

export interface InsuranceInfo {
  company: string;
  coverage: string;
  policy: string;
  emergencyPhone: string;
  doc: DocumentRef | null;
}

export interface TripDocuments {
  /** Agganciato automaticamente dal Passaporto Master del Profilo. */
  passport: PassportInfo | null;
  customs: CustomsInfo | null;
  transports: Transport[];
  insurance: InsuranceInfo | null;
}

export interface EmergencyContact {
  id: string;
  title: string;
  subtitle: string;
  actionLabel: string;
  /** Numero già normalizzato per `Linking.openURL('tel:…')`. */
  phone: string;
  /** Il coordinatore ha in più il tasto WhatsApp. */
  whatsapp?: boolean;
}

/* ── Ricordi ─────────────────────────────────────────────────────────── */

/** `crew` = visibile a tutti i compagni, `private` = solo a chi l'ha caricato. */
export type MemoryVisibility = 'crew' | 'private';

/** Etichetta editoriale della nota di diario. */
export type NoteMood = '😂 Aneddoto' | '📍 Posto' | '💭 Pensiero' | '🔒 Personale';

export type ReactionKey = '🔥' | '😂' | '❤️' | '🤯';

interface MemoryBase {
  id: string;
  dayId: DayId;
  authorId: string;
  /** Orario leggibile: '18:42'. */
  time: string;
  visibility: MemoryVisibility;
}

export interface PhotoMemory extends MemoryBase {
  kind: 'photo' | 'video';
  uri: string;
  blurhash: string;
  caption?: string;
  /** Proporzione nota a priori: la cella della griglia non cambia dimensione al caricamento. */
  aspectRatio: number;
  /** Solo per i video: '0:14'. */
  durationLabel?: string;
  reactions: Partial<Record<ReactionKey, number>>;
  myReaction: ReactionKey | null;
}

export interface NoteMemory extends MemoryBase {
  kind: 'note';
  text: string;
  mood: NoteMood;
}

export type Memory = PhotoMemory | NoteMemory;

/** Payload della modale "Nuovo Ricordo". */
export interface NewMemoryDraft {
  dayId: DayId;
  format: 'media' | 'note';
  visibility: MemoryVisibility;
  /** Testo della nota oppure didascalia della foto. */
  text: string;
  mood: NoteMood;
  /** URI scelto dal rullino quando `format === 'media'`. */
  uri?: string;
}

/* ── Viaggio completo ────────────────────────────────────────────────── */

export interface Trip {
  id: string;
  status: TripStatus;
  /** Comprensivo di emoji bandiera: "Islanda On The Road 🇮🇸". */
  title: string;
  cover?: string;
  coverBlurhash: string;
  /** ISO `YYYY-MM-DD`. */
  startDate: string;
  endDate: string;
  totalDays: number;
  /** Valorizzato solo se `status === 'ongoing'`. */
  currentDay?: number;
  coordinator: CrewMember;
  crew: CrewMember[];
  /** Posti totali del gruppo, per "8 confermati su 10 posti". */
  crewCapacity?: number;
  /** Slug del link di invito: `vibemakers.travel/join/<inviteCode>`. */
  inviteCode: string;
  days: TripDay[];
  documents: TripDocuments;
  emergencies: EmergencyContact[];
  memories: Memory[];
}

/** Dati raccolti da `CreateTripScreen` prima che il viaggio esista. */
export interface NewTripDraft {
  title: string;
  cover?: string;
  startDate: string;
  endDate: string;
  coordinatorName: string;
  coordinatorPhone: string;
  crewNames: string[];
}

/* ── Profilo ─────────────────────────────────────────────────────────── */

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  avatar: string;
  /** Bio libera, massimo 300 caratteri. */
  bio: string;
  /** Passaporto Master: una sola foto, riusata da tutti i viaggi. */
  passport: {
    number: string;
    expiry: string;
    photoUri: string;
  };
  fiscalCode: string;
  diet: string;
  medicalNotes: string;
  biometricUnlock: boolean;
}
