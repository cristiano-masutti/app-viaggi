import { daysBetween, shortDate, todayISO } from '@/lib/date';
import { blurhash } from '@/theme/palette';
import type {
  CrewMember,
  DayId,
  DocumentRef,
  EmergencyContact,
  Memory,
  NewTripDraft,
  NoteMood,
  ReactionKey,
  Trip,
  TripDay,
  TripStatus,
  UserProfile,
} from '@/types';

import type {
  ApiNoteMood,
  ApiReaction,
  CreateTripBody,
  DocumentDto,
  InvitationDto,
  MemberDto,
  MemoryDto,
  ProfileDto,
  TripDetailDto,
  TripSummaryDto,
  UpdateProfileBody,
} from './types';

/**
 * Traduzione fra il modello dell'API e quello che le schermate già usano
 * (`src/types`). Tutto quello che dipende dall'orologio del telefono — stato
 * del viaggio, giorno corrente, '16 Set', '18:42' — si calcola qui, sul device:
 * il server manda solo date ISO.
 */

/* ── Riferimenti ai file ─────────────────────────────────────────────── */

/**
 * I file dell'API non hanno un URL fisso: si aprono con URL firmati che
 * scadono. Il modello del mobile tiene un riferimento stabile, e chi scarica
 * (la libreria offline, i viewer) lo risolve in un URL firmato al momento.
 */
export const apiFileUri = {
  document: (tripId: string, documentId: string) => `api:trips/${tripId}/documents/${documentId}`,
  memory: (tripId: string, memoryId: string) => `api:trips/${tripId}/memories/${memoryId}`,
  passport: () => 'api:me/passport/photo',
};

/** Il percorso dell'API che firma il file, oppure `null` se l'URI non è un riferimento dell'API. */
export function signedUrlPathFor(uri: string): string | null {
  if (!uri.startsWith('api:')) return null;
  const path = uri.slice('api:'.length);
  if (path === 'me/passport/photo') return '/api/me/passport/photo/url';
  if (/^trips\/[^/]+\/documents\/[^/]+$/.test(path)) return `/api/${path}/url`;
  if (/^trips\/[^/]+\/memories\/[^/]+$/.test(path)) return `/api/${path}/media-url`;
  return null;
}

/* ── Calendario del viaggio ──────────────────────────────────────────── */

/** In corso, futuro o passato rispetto a oggi, e il giorno corrente se è in corso. */
export function tripTimeline(
  startDate: string,
  endDate: string,
  today: string = todayISO(),
): { status: TripStatus; currentDay?: number } {
  if (today < startDate) return { status: 'upcoming' };
  if (today > endDate) return { status: 'past' };
  return { status: 'ongoing', currentDay: daysBetween(startDate, today) };
}

export const dayIdOf = (index: number): DayId => `G${index}`;

/** 'G3' → 3. */
export function dayIndexOf(dayId: DayId): number {
  const index = Number(dayId.replace(/^G/, ''));
  if (!Number.isInteger(index) || index < 1) throw new Error(`Not a day id: ${dayId}`);
  return index;
}

/* ── Crew ────────────────────────────────────────────────────────────── */

/** 'Marco R.', come la crew appare nelle card; '@marco' o 'Viaggiatore' se il profilo è vuoto. */
export function displayName({ firstName, lastName, username }: Pick<MemberDto, 'firstName' | 'lastName' | 'username'>) {
  if (firstName) return lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
  return username ? `@${username}` : 'Viaggiatore';
}

export const toCrewMember = (member: MemberDto): CrewMember => ({
  id: member.userId,
  name: displayName(member),
  handle: member.username ? `@${member.username}` : '—',
  role: member.role,
  confirmed: true,
});

/** Un posto riservato appare nella crew come "invitato, non ancora confermato". */
export const toPendingMember = (invitation: InvitationDto): CrewMember => ({
  id: invitation.id,
  name: invitation.name,
  handle: invitation.email ?? '—',
  role: 'traveller',
  confirmed: false,
});

const NO_COORDINATOR: CrewMember = { id: '', name: 'Coordinatore', handle: '—', role: 'coordinator', confirmed: true };

/* ── Documenti ───────────────────────────────────────────────────────── */

export function toDocumentRef(tripId: string, doc: DocumentDto | null): DocumentRef | null {
  if (!doc) return null;
  return {
    id: doc.id,
    kind: doc.kind,
    title: doc.title,
    subtitle: doc.subtitle,
    code: doc.code,
    // Un QR senza file si disegna dal codice: non c'è niente da scaricare.
    uri: doc.hasFile ? apiFileUri.document(tripId, doc.id) : '',
  };
}

/* ── Viaggio ─────────────────────────────────────────────────────────── */

const EMPTY_DOCUMENTS: Trip['documents'] = { passport: null, customs: null, transports: [], insurance: null };

function baseTrip(dto: TripSummaryDto | TripDetailDto, crew: CrewMember[], today?: string): Trip {
  const confirmed = crew.filter((member) => member.confirmed);
  return {
    id: dto.id,
    ...tripTimeline(dto.startDate, dto.endDate, today),
    title: dto.title,
    // Copertine non ancora gestite dal backend: il blurhash tiene la forma della card.
    coverBlurhash: blurhash.ink,
    startDate: dto.startDate,
    endDate: dto.endDate,
    totalDays: dto.totalDays,
    coordinator: confirmed.find((member) => member.role === 'coordinator') ?? NO_COORDINATOR,
    crew,
    crewCapacity: dto.crewCapacity ?? undefined,
    inviteCode: dto.inviteCode,
    days: [],
    documents: EMPTY_DOCUMENTS,
    emergencies: [],
    memories: [],
  };
}

/** Card dell'hub: giorni, documenti e ricordi arrivano col dettaglio. */
export function tripFromSummary(dto: TripSummaryDto, today?: string): Trip {
  return { ...baseTrip(dto, dto.crew.map(toCrewMember), today), mediaCount: dto.mediaCount };
}

export function tripFromDetail(dto: TripDetailDto, today?: string): Trip {
  const crew = [...dto.crew.map(toCrewMember), ...dto.invitations.map(toPendingMember)];
  const doc = (document: DocumentDto | null) => toDocumentRef(dto.id, document);

  const days: TripDay[] = dto.days.map((day) => ({
    id: dayIdOf(day.index),
    index: day.index,
    label: dayIdOf(day.index),
    date: shortDate(day.date),
    stay: day.stay ? { name: day.stay.name, address: day.stay.address, doc: doc(day.stay.doc) } : null,
    activities: day.activities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      place: activity.place,
      doc: doc(activity.doc),
    })),
  }));

  const { passport, customs, insurance, transports } = dto.documents;

  return {
    ...baseTrip(dto, crew, today),
    days,
    documents: {
      passport: passport && {
        number: passport.number ?? '',
        expiry: passport.expiry ?? '',
        doc: passport.hasPhoto
          ? {
              id: 'passport-master',
              kind: 'image',
              title: 'Passaporto',
              subtitle: 'Pagina dati',
              code: passport.number ?? '',
              uri: apiFileUri.passport(),
            }
          : null,
      },
      customs: customs && { code: customs.code, note: customs.note, doc: doc(customs.doc) },
      insurance: insurance && {
        company: insurance.company,
        coverage: insurance.coverage,
        policy: insurance.policy,
        emergencyPhone: insurance.emergencyPhone,
        doc: doc(insurance.doc),
      },
      transports: transports.map((transport) => ({
        id: transport.id,
        name: transport.name,
        reference: transport.reference,
        mode: transport.mode,
        docs: transport.docs.map((item) => ({ id: item.id, label: item.label, doc: doc(item.doc) })),
      })),
    },
    emergencies: dto.emergencies.map(
      (contact): EmergencyContact => ({
        id: contact.id,
        title: contact.title,
        subtitle: contact.subtitle,
        actionLabel: contact.actionLabel,
        phone: contact.phone,
        whatsapp: contact.whatsapp || undefined,
      }),
    ),
  };
}

/* ── Ricordi ─────────────────────────────────────────────────────────── */

const REACTION_KEYS = { fire: '🔥', laugh: '😂', love: '❤️', mindblown: '🤯' } as const satisfies Record<
  ApiReaction,
  ReactionKey
>;

const MOOD_LABELS = {
  anecdote: '😂 Aneddoto',
  place: '📍 Posto',
  thought: '💭 Pensiero',
  personal: '🔒 Personale',
} as const satisfies Record<ApiNoteMood, NoteMood>;

const invert = <K extends string, V extends string>(map: Record<K, V>) =>
  Object.fromEntries(Object.entries(map).map(([key, value]) => [value, key])) as Record<V, K>;

export const toApiReaction: (reaction: ReactionKey) => ApiReaction = (reaction) => invert(REACTION_KEYS)[reaction];
export const toApiMood: (mood: NoteMood) => ApiNoteMood = (mood) => invert(MOOD_LABELS)[mood];

/** '18:42', nell'ora del telefono. */
const timeLabel = (iso: string) =>
  new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });

/** 14 → '0:14', 75 → '1:15'. */
const durationLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${`${seconds % 60}`.padStart(2, '0')}`;

export function toMemory(tripId: string, dto: MemoryDto): Memory {
  const base = {
    id: dto.id,
    dayId: dayIdOf(dto.dayIndex),
    authorId: dto.authorId,
    time: timeLabel(dto.createdAt),
    visibility: dto.visibility,
  };

  if (dto.kind === 'note') return { ...base, kind: 'note', text: dto.text, mood: MOOD_LABELS[dto.mood] };

  const reactions: Partial<Record<ReactionKey, number>> = {};
  for (const reaction of Object.keys(dto.reactions) as ApiReaction[]) {
    reactions[REACTION_KEYS[reaction]] = dto.reactions[reaction];
  }

  return {
    ...base,
    kind: dto.kind,
    uri: apiFileUri.memory(tripId, dto.id),
    blurhash: dto.blurhash ?? blurhash.ink,
    caption: dto.caption ?? undefined,
    aspectRatio: dto.aspectRatio,
    durationLabel: dto.durationSeconds === null ? undefined : durationLabel(dto.durationSeconds),
    reactions,
    myReaction: dto.myReaction ? REACTION_KEYS[dto.myReaction] : null,
  };
}

/* ── Dal mobile all'API ──────────────────────────────────────────────── */

/**
 * La bozza di `CreateTripScreen` diventa il body di `POST /api/trips`. Chi la
 * invia diventa coordinatore; i compagni elencati diventano posti riservati, e
 * le card SOS iniziali sono le stesse del prototipo.
 */
export function toCreateTripBody(draft: NewTripDraft): CreateTripBody {
  const emergencies: CreateTripBody['emergencies'] = [];
  if (draft.coordinatorPhone.trim()) {
    emergencies.push({
      title: `📣 ${draft.coordinatorName} • Coordinatore`,
      subtitle: 'Primo contatto del gruppo, sempre raggiungibile',
      actionLabel: 'Chiama il coordinatore',
      phone: draft.coordinatorPhone,
      whatsapp: true,
    });
  }
  emergencies.push({
    title: '🚨 112 • Numero Unico Emergenze',
    subtitle: 'Polizia, ambulanza, vigili del fuoco e soccorso stradale',
    actionLabel: 'Chiama 112',
    phone: '112',
    whatsapp: false,
  });

  return {
    title: draft.title.trim(),
    startDate: draft.startDate,
    endDate: draft.endDate,
    invitees: draft.crewNames.map((name) => name.trim()).filter(Boolean).map((name) => ({ name })),
    emergencies,
  };
}

/**
 * Il profilo dell'API più ciò che resta solo sul telefono: lo sblocco
 * biometrico è un'impostazione del device, l'avatar non è ancora sul backend.
 */
export function toUserProfile(dto: ProfileDto, local: Pick<UserProfile, 'avatar' | 'biometricUnlock'>): UserProfile {
  return {
    id: dto.id,
    firstName: dto.firstName,
    lastName: dto.lastName,
    username: dto.username ? `@${dto.username}` : '',
    avatar: local.avatar,
    bio: dto.bio,
    passport: {
      number: dto.passport?.number ?? '',
      expiry: dto.passport?.expiry ?? '',
      photoUri: dto.passport?.hasPhoto ? apiFileUri.passport() : '',
    },
    fiscalCode: dto.fiscalCode ?? '',
    diet: dto.diet,
    medicalNotes: dto.medicalNotes,
    biometricUnlock: local.biometricUnlock,
  };
}

/** Solo i campi che vivono sul server; il resto di `patchProfile` resta locale. */
export function toProfilePatch(patch: Partial<UserProfile>): UpdateProfileBody {
  const body: UpdateProfileBody = {};
  if (patch.firstName !== undefined) body.firstName = patch.firstName;
  if (patch.lastName !== undefined) body.lastName = patch.lastName;
  if (patch.username !== undefined) body.username = patch.username || null;
  if (patch.bio !== undefined) body.bio = patch.bio;
  if (patch.fiscalCode !== undefined) body.fiscalCode = patch.fiscalCode || null;
  if (patch.diet !== undefined) body.diet = patch.diet;
  if (patch.medicalNotes !== undefined) body.medicalNotes = patch.medicalNotes;
  if (patch.passport !== undefined) {
    const { number, expiry } = patch.passport;
    body.passport = number && expiry ? { number, expiry } : null;
  }
  return body;
}
