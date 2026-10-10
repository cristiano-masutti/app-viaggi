import { buildEmptyDays, daysBetween } from '@/lib/date';
import { createId } from '@/lib/id';
import { blurhash } from '@/theme/palette';
import type { CrewMember, Memory, NewMemoryDraft, NewTripDraft, Trip } from '@/types';

/**
 * Dalle bozze delle schermate agli oggetti del modello. Il prototipo le usa
 * come dati definitivi; la modalità reale per mostrare subito il risultato
 * (aggiornamento ottimistico) in attesa della versione del server.
 */

/** Ora corrente in formato '18:42', come la scrive un ricordo appena salvato. */
export const nowLabel = () =>
  new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Costruisce il viaggio dalla bozza del form: giorni vuoti, crew in attesa di conferma. */
export function tripFromDraft(draft: NewTripDraft, me: CrewMember): Trip {
  const totalDays = daysBetween(draft.startDate, draft.endDate);

  const coordinator: CrewMember = {
    id: createId('crew'),
    name: draft.coordinatorName,
    handle: draft.coordinatorPhone || '—',
    role: 'coordinator',
    confirmed: true,
  };

  const crew: CrewMember[] = [
    me,
    coordinator,
    // I compagni inseriti nel form partono come invitati non ancora confermati.
    ...draft.crewNames.map((name) => ({
      id: createId('crew'),
      name,
      handle: '—',
      role: 'traveller' as const,
      confirmed: false,
    })),
  ];

  return {
    id: createId('trip'),
    status: 'upcoming',
    title: draft.title,
    cover: draft.cover,
    coverBlurhash: blurhash.ink,
    startDate: draft.startDate,
    endDate: draft.endDate,
    totalDays,
    coordinator,
    crew,
    crewCapacity: Math.max(crew.length, 10),
    inviteCode: `${draft.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 18)}-${Math.random().toString(36).slice(2, 6)}`,
    // Giorni vuoti: la tab Organizza li mostrerà come placeholder da riempire.
    days: buildEmptyDays(draft.startDate, totalDays),
    documents: { passport: null, customs: null, transports: [], insurance: null },
    emergencies: [
      {
        id: createId('sos'),
        title: `📣 ${coordinator.name} • Coordinatore`,
        subtitle: 'Primo contatto del gruppo, sempre raggiungibile',
        actionLabel: 'Chiama il coordinatore',
        phone: draft.coordinatorPhone || '112',
        whatsapp: true,
      },
      {
        id: createId('sos'),
        title: '🚨 112 • Numero Unico Emergenze',
        subtitle: 'Polizia, ambulanza, vigili del fuoco e soccorso stradale',
        actionLabel: 'Chiama 112',
        phone: '112',
      },
    ],
    memories: [],
  };
}

export function memoryFromDraft(draft: NewMemoryDraft, authorId: string): Memory {
  const base = {
    id: createId('mem'),
    dayId: draft.dayId,
    authorId,
    time: nowLabel(),
    visibility: draft.visibility,
  };

  return draft.format === 'note'
    ? {
        ...base,
        kind: 'note',
        text: draft.text,
        // Una nota privata è sempre etichettata 🔒, qualunque tag fosse selezionato.
        mood: draft.visibility === 'private' ? '🔒 Personale' : draft.mood,
      }
    : {
        ...base,
        kind: 'photo',
        uri: draft.uri ?? '',
        blurhash: blurhash.ink,
        caption: draft.text || undefined,
        aspectRatio: 1,
        reactions: {},
        myReaction: null,
      };
}
