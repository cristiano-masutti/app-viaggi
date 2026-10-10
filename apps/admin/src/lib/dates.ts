/**
 * Date in italiano, come nell'app. Un viaggio è fatto di giorni, senza orari:
 * tutto passa da stringhe `YYYY-MM-DD` e da differenze in giorni interi.
 */

const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` → anno, mese (0-11), giorno, senza passare dal fuso del browser. */
function parts(iso: string) {
  const [year, month, day] = iso.split('-').map(Number) as [number, number, number];
  return { year, month: month - 1, day };
}

const toUtc = (iso: string) => {
  const { year, month, day } = parts(iso);
  return Date.UTC(year, month, day);
};

/** Oggi per chi guarda il pannello, come data senza orario. */
export function todayISO(now = new Date()): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Giorni da `from` a `to` (negativi se `to` è prima). */
export const daysBetween = (from: string, to: string) => Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);

/** '14 Set' */
export function shortDate(iso: string): string {
  const { month, day } = parts(iso);
  return `${day} ${MONTHS_SHORT[month]}`;
}

/** '14–23 Set 2027', '28 Set – 3 Ott 2027', '28 Dic 2027 – 3 Gen 2028' */
export function dateRange(start: string, end: string): string {
  const from = parts(start);
  const to = parts(end);
  if (from.year !== to.year) return `${shortDate(start)} ${from.year} – ${shortDate(end)} ${to.year}`;
  if (from.month !== to.month) return `${shortDate(start)} – ${shortDate(end)} ${to.year}`;
  if (from.day === to.day) return `${shortDate(start)} ${to.year}`;
  return `${from.day}–${to.day} ${MONTHS_SHORT[to.month]} ${to.year}`;
}

/** '18 Set 2027' */
export const longDate = (iso: string) => `${shortDate(iso)} ${parts(iso).year}`;

/** Da un istante ISO (createdAt, joinedAt) al giorno: '3 Ott 2027'. */
export const dayOf = (instant: string) => longDate(todayISO(new Date(instant)));
