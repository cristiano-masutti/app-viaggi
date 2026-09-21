import { dateRange, daysUntil, monthYear } from '@/lib/date';
import type { Memory, Trip, TripStatus } from '@/types';

/** Etichetta della pillola in alto alla card, diversa per ogni segmento. */
export function tripBadge(trip: Trip): string {
  if (trip.status === 'ongoing') {
    return `LIVE • GIORNO ${trip.currentDay ?? 1} DI ${trip.totalDays}`;
  }
  if (trip.status === 'past') return '🎒 Concluso';

  const missing = daysUntil(trip.startDate);
  if (missing === 0) return '⏳ Si parte oggi!';
  if (missing === 1) return '⏳ Si parte domani!';
  return `⏳ Mancano ${missing} giorni`;
}

/** Riga di metadati sotto il titolo. */
export function tripMeta(trip: Trip): string {
  if (trip.status === 'past') {
    const photos = trip.memories.filter((memory) => memory.kind !== 'note').length;
    const tail = photos > 0 ? ` · ${photos} ricordi` : '';
    return `${monthYear(trip.startDate)} · ${trip.totalDays} giorni${tail}`;
  }
  return `${dateRange(trip.startDate, trip.endDate)} · ${trip.totalDays} giorni`;
}

/** "8 confermati su 10 posti" oppure "8 compagni di viaggio" per i passati. */
export function crewLabel(trip: Trip): string {
  const confirmed = trip.crew.filter((member) => member.confirmed).length;
  if (trip.status === 'past') return `${trip.crew.length} compagni di viaggio`;
  return trip.crewCapacity
    ? `${confirmed} confermati su ${trip.crewCapacity} posti`
    : `${confirmed} confermati`;
}

/** Sottotitolo dell'header dell'hub, agganciato al tab attivo. */
export const HUB_SUBTITLES: Record<TripStatus, string> = {
  ongoing: 'Zaino in spalla, si esplora! 🌍',
  upcoming: 'Il conto alla rovescia è iniziato 🎒',
  past: 'Quanti ricordi insieme... ✨',
};

export const TRIP_TAB_LABELS: Record<TripStatus, string> = {
  ongoing: 'In Corso',
  upcoming: 'Futuri',
  past: 'Passati',
};

/** Link di invito della crew, come appare nella schermata di successo. */
export const inviteLink = (trip: Trip) => `vibemakers.travel/join/${trip.inviteCode}`;

/** Il giorno da cui aprire la tab Organizza: oggi se il viaggio è in corso, G1 altrimenti. */
export function defaultDayId(trip: Trip): string {
  if (trip.status === 'ongoing' && trip.currentDay) {
    const day = trip.days.find((item) => item.index === trip.currentDay);
    if (day) return day.id;
  }
  return trip.days[0]?.id ?? 'G1';
}

/** Solo foto e video, ordinati dal più recente. */
export const photoMemories = (memories: Memory[]) =>
  memories.filter((memory): memory is Extract<Memory, { kind: 'photo' | 'video' }> => memory.kind !== 'note');

/** Solo note di diario. */
export const noteMemories = (memories: Memory[]) =>
  memories.filter((memory): memory is Extract<Memory, { kind: 'note' }> => memory.kind === 'note');
