/**
 * "È pronto per partire?" — la checklist che lo staff guarda per ogni viaggio.
 *
 * Funzione pura sui dati del viaggio: le route caricano, questo file decide.
 * Così le regole stanno in un posto solo e si provano senza database.
 */

export const READINESS_ISSUES = [
  'MISSING_STAYS',
  'NO_INSURANCE',
  'NO_TRANSPORT',
  'NO_EMERGENCY_CONTACTS',
  'MISSING_PASSPORTS',
  'PASSPORTS_EXPIRING',
] as const;

export type ReadinessIssue = (typeof READINESS_ISSUES)[number];

export interface ReadinessInput {
  startDate: Date;
  endDate: Date;
  totalDays: number;
  /** Indici (1-based) dei giorni con un alloggio. */
  stayDays: number[];
  hasInsurance: boolean;
  transports: number;
  emergencyContacts: number;
  members: Array<{ passportNumber: string | null; passportExpiry: string | null }>;
}

export interface Readiness {
  /** Notti coperte da un alloggio, sulle notti del viaggio (l'ultimo giorno si rientra). */
  stays: { covered: number; needed: number };
  insurance: boolean;
  transport: boolean;
  emergencyContacts: boolean;
  /** Chi ha il passaporto nel profilo, e quanti scadono troppo presto. */
  passports: { ready: number; total: number; expiring: number };
  issues: ReadinessIssue[];
}

/** Molti paesi chiedono un passaporto valido almeno sei mesi oltre il rientro. */
const PASSPORT_MARGIN_MONTHS = 6;

/** 'MM/AAAA' → l'ultimo giorno di quel mese; `null` se il formato non torna. */
export function passportValidUntil(expiry: string): Date | null {
  const match = /^(\d{2})\/(\d{4})$/.exec(expiry);
  if (!match) return null;
  const month = Number(match[1]);
  const year = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month, 0));
}

function expiresTooSoon(expiry: string | null, endDate: Date): boolean {
  if (!expiry) return false;
  const validUntil = passportValidUntil(expiry);
  if (!validUntil) return false;
  const required = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth() + PASSPORT_MARGIN_MONTHS, endDate.getUTCDate()),
  );
  return validUntil < required;
}

export function assessReadiness(input: ReadinessInput): Readiness {
  const needed = Math.max(0, input.totalDays - 1);
  const covered = new Set(input.stayDays.filter((day) => day >= 1 && day <= needed)).size;

  const withPassport = input.members.filter((member) => member.passportNumber);
  const expiring = withPassport.filter((member) =>
    expiresTooSoon(member.passportExpiry, input.endDate),
  ).length;

  const readiness: Omit<Readiness, 'issues'> = {
    stays: { covered, needed },
    insurance: input.hasInsurance,
    transport: input.transports > 0,
    emergencyContacts: input.emergencyContacts > 0,
    passports: { ready: withPassport.length, total: input.members.length, expiring },
  };

  const issues: ReadinessIssue[] = [];
  if (covered < needed) issues.push('MISSING_STAYS');
  if (!readiness.insurance) issues.push('NO_INSURANCE');
  if (!readiness.transport) issues.push('NO_TRANSPORT');
  if (!readiness.emergencyContacts) issues.push('NO_EMERGENCY_CONTACTS');
  if (withPassport.length < input.members.length) issues.push('MISSING_PASSPORTS');
  if (expiring > 0) issues.push('PASSPORTS_EXPIRING');

  return { ...readiness, issues };
}
