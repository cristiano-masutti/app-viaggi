import { randomInt } from 'node:crypto';

/** Senza caratteri che si confondono (0/o, 1/l/i): il link si può anche dettare. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const RANDOM_LENGTH = 12;

/**
 * Codice del link di invito: `islanda-on-the-road-k7m2x9p4q3ra`.
 *
 * Il prefisso leggibile viene dal titolo e non conta nulla per la sicurezza:
 * la parte casuale (12 caratteri su 31, circa 59 bit) basta da sola a rendere
 * impraticabile indovinare un link valido.
 */
export function generateInviteCode(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .slice(0, 24)
    .replace(/-+$/, '');

  const random = Array.from({ length: RANDOM_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return slug ? `${slug}-${random}` : random;
}

export const INVITE_CODE_PATTERN = /^[a-z0-9-]{12,40}$/;
