import { badRequest } from './errors.js';

/**
 * Cursori opachi per le liste ordinate dal più recente: (createdAt, id) è
 * stabile anche quando due righe hanno lo stesso istante di creazione.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface Cursor {
  createdAt: Date;
  id: string;
}

export const encodeCursor = ({ createdAt, id }: Cursor) =>
  Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');

export function decodeCursor(cursor: string): Cursor {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = new Date(iso ?? '');
  // Un id che non è un UUID arriverebbe a Postgres come errore di tipo (500).
  if (!id || !UUID.test(id) || Number.isNaN(createdAt.getTime())) {
    throw badRequest('INVALID_CURSOR', 'The cursor is not valid');
  }
  return { createdAt, id };
}
