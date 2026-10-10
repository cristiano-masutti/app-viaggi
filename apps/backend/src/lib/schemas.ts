import { z } from 'zod';

/**
 * Date in ingresso e in uscita dall'API.
 *
 * Sono codec: la route riceve già un `Date` e restituisce un `Date`, il formato
 * sul filo lo decide solo questo file. `isoDate` è per le date senza orario
 * (inizio e fine viaggio, `YYYY-MM-DD`), che non devono mai slittare di un
 * giorno per colpa del fuso: vivono sempre a mezzanotte UTC, come `@db.Date`.
 */
export const isoDate = z.codec(z.iso.date(), z.date(), {
  decode: (value) => new Date(`${value}T00:00:00.000Z`),
  encode: (date) => date.toISOString().slice(0, 10),
});

export const isoDateTime = z.codec(z.iso.datetime({ offset: true }), z.date(), {
  decode: (value) => new Date(value),
  encode: (date) => date.toISOString(),
});
