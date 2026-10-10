import { createHash } from 'node:crypto';

import { z } from 'zod';

import { isoDateTime } from '../../lib/schemas.js';

/** '@MarcoRossi' e 'marcorossi' sono lo stesso username. */
export const Username = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, '').toLowerCase())
  .pipe(
    z
      .string()
      .regex(/^[a-z0-9._]{3,30}$/, 'Username: 3-30 characters among letters, digits, dot and underscore'),
  );

/** Formato del codice fiscale (omocodie comprese), senza carattere di controllo. */
const FiscalCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/,
    'Expected an Italian fiscal code',
  );

const Passport = z.object({
  number: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{5,12}$/, 'Expected 5-12 letters or digits'),
  /** Mese e anno, come stampati sul documento. */
  expiry: z
    .string()
    .trim()
    .regex(/^(0[1-9]|1[0-2])\/\d{4}$/, 'Expected MM/YYYY'),
});

export const UpdateProfileBody = z.object({
  firstName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  username: Username.nullable().optional(),
  bio: z.string().trim().max(300).optional(),
  fiscalCode: FiscalCode.nullable().optional(),
  diet: z.string().trim().max(200).optional(),
  medicalNotes: z.string().trim().max(300).optional(),
  /** `null` cancella il passaporto, foto compresa. */
  passport: Passport.nullable().optional(),
});

/** Dati e foto sono indipendenti: si può scrivere il numero oggi e fotografare domani. */
export const PassportDto = z.object({
  number: z.string().nullable(),
  expiry: z.string().nullable(),
  hasPhoto: z.boolean(),
  /**
   * Cambia a ogni nuova scansione, `null` senza foto. Il client lo usa per
   * capire che la copia salvata sul telefono è vecchia: l'URL della foto, da
   * solo, è sempre lo stesso.
   */
  photoVersion: z.string().nullable(),
});

/** Opaca: dal percorso nel bucket, senza rivelarlo. */
const photoVersionOf = (storagePath: string) =>
  createHash('sha256').update(storagePath).digest('hex').slice(0, 16);

export const ProfileDto = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string().nullable(),
  bio: z.string(),
  fiscalCode: z.string().nullable(),
  diet: z.string(),
  medicalNotes: z.string(),
  passport: PassportDto.nullable(),
  createdAt: isoDateTime,
});

export const toPassportDto = (user: {
  passportNumber: string | null;
  passportExpiry: string | null;
  passportPhotoPath: string | null;
}) =>
  user.passportNumber || user.passportPhotoPath
    ? {
        number: user.passportNumber,
        expiry: user.passportExpiry,
        hasPhoto: user.passportPhotoPath !== null,
        photoVersion: user.passportPhotoPath ? photoVersionOf(user.passportPhotoPath) : null,
      }
    : null;
