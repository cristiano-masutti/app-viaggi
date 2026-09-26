import type { TripDay } from '@/types';

/**
 * Helper di date, in italiano e senza dipendenze.
 *
 * Il viaggio non gestisce orari: la granularità è il giorno, quindi tutto ruota
 * attorno a stringhe ISO `YYYY-MM-DD` e a differenze in giorni interi.
 */

const MS_PER_DAY = 86_400_000;

export const MONTHS_IT = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

const MONTHS_SHORT_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

/** Mezzanotte locale: azzera l'ora così le differenze restano numeri interi. */
const atMidnight = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const todayISO = () => toISO(new Date());

export const toISO = (date: Date) => {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

/** `YYYY-MM-DD` → Date locale (evita lo shift UTC di `new Date('2026-01-01')`). */
export const fromISO = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

/** Giorni inclusivi tra due date: 12→13 ottobre = 2 giorni. */
export const daysBetween = (startISO: string, endISO: string) =>
  Math.round((atMidnight(fromISO(endISO)).getTime() - atMidnight(fromISO(startISO)).getTime()) / MS_PER_DAY) +
  1;

/** Giorni che mancano alla partenza; 0 se è oggi o è già passata. */
export const daysUntil = (iso: string) =>
  Math.max(
    0,
    Math.round((atMidnight(fromISO(iso)).getTime() - atMidnight(new Date()).getTime()) / MS_PER_DAY),
  );

/** '16 Set' — l'etichetta sotto il filtro del giorno. */
export const shortDate = (iso: string) => {
  const date = fromISO(iso);
  return `${date.getDate()} ${MONTHS_SHORT_IT[date.getMonth()]}`;
};

/** '12 – 24 Ottobre' oppure '28 Dicembre – 4 Gennaio' se il mese cambia. */
export const dateRange = (startISO: string, endISO: string) => {
  const from = fromISO(startISO);
  const to = fromISO(endISO);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `${from.getDate()} – ${to.getDate()} ${MONTHS_IT[to.getMonth()]}`
    : `${from.getDate()} ${MONTHS_IT[from.getMonth()]} – ${to.getDate()} ${MONTHS_IT[to.getMonth()]}`;
};

/** 'Maggio 2025' — come si ricorda un viaggio finito. */
export const monthYear = (iso: string) => {
  const date = fromISO(iso);
  return `${MONTHS_IT[date.getMonth()]} ${date.getFullYear()}`;
};

/** '12/10/2026' → Date, `null` se la data non esiste (31/02, testo incompleto…). */
export const parseItalianDate = (value: string): Date | null => {
  const match = value.trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const valid = date.getDate() === Number(day) && date.getMonth() === Number(month) - 1;
  return valid ? date : null;
};

/** Inserisce le barre mentre si digita: `12102026` → `12/10/2026`. */
export const maskItalianDate = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
};

/**
 * Costruisce lo scheletro dei giorni (G1…Gn) di un viaggio appena creato.
 * Nascono tutti vuoti: nella tab Organizza appariranno come placeholder
 * tratteggiati da riempire.
 */
export const buildEmptyDays = (startISO: string, totalDays: number): TripDay[] => {
  const start = fromISO(startISO);
  return Array.from({ length: totalDays }, (_, offset) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
    return {
      id: `G${offset + 1}`,
      index: offset + 1,
      label: `G${offset + 1}`,
      date: shortDate(toISO(date)),
      stay: null,
      activities: [],
    };
  });
};
