import { badRequest } from './errors.js';

/**
 * Cursori opachi per le liste ordinate dal più recente: (createdAt, id) è
 * stabile anche quando due righe hanno lo stesso istante di creazione.
 */
export interface Cursor {
  createdAt: Date;
  id: string;
}

export const encodeCursor = ({ createdAt, id }: Cursor) =>
  Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');

export function decodeCursor(cursor: string): Cursor {
  const [iso, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  const createdAt = new Date(iso ?? '');
  if (!id || Number.isNaN(createdAt.getTime())) throw badRequest('INVALID_CURSOR', 'The cursor is not valid');
  return { createdAt, id };
}
