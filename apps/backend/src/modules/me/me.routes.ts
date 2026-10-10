import crypto from 'node:crypto';

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { Prisma, type User } from '../../generated/prisma/client.js';
import { AppError, notFound } from '../../lib/errors.js';
import { DOCUMENT_FILE_TYPES, extensionFor } from '../../lib/file-types.js';
import { readUpload, requireFile } from '../../lib/multipart.js';
import { removeStoredFiles } from '../../storage/cleanup.js';
import { SignedUrlDto } from '../documents/documents.schemas.js';
import { PassportDto, ProfileDto, toPassportDto, UpdateProfileBody } from './me.schemas.js';

const toProfileDto = (user: User) => ({ ...user, passport: toPassportDto(user) });
const ProfileResponse = z.object({ user: ProfileDto });

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/**
 * Il profilo di chi chiede, e solo il suo. Contiene dati personali e
 * sanitari: nessuna route espone il profilo di un altro utente.
 */
export const meRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/me', { schema: { response: { 200: ProfileResponse } } }, async (request) => {
    const user = await app.prisma.user.findUniqueOrThrow({ where: { id: request.user.id } });
    return { user: toProfileDto(user) };
  });

  app.patch(
    '/me',
    { schema: { body: UpdateProfileBody, response: { 200: ProfileResponse } } },
    async (request) => {
      const { passport, ...fields } = request.body;
      const current = await app.prisma.user.findUniqueOrThrow({ where: { id: request.user.id } });

      // `passport: null` cancella numero, scadenza e foto.
      const passportData =
        passport === undefined
          ? {}
          : passport === null
            ? { passportNumber: null, passportExpiry: null, passportPhotoPath: null }
            : { passportNumber: passport.number, passportExpiry: passport.expiry };

      let user: User;
      try {
        user = await app.prisma.user.update({
          where: { id: current.id },
          data: { ...fields, ...passportData },
        });
      } catch (error) {
        if (isUniqueViolation(error))
          throw new AppError(409, 'USERNAME_TAKEN', 'This username is already taken');
        throw error;
      }

      if (passport === null) await removeStoredFiles(app.storage, request.log, [current.passportPhotoPath]);
      return { user: toProfileDto(user) };
    },
  );

  /** Scansione della pagina dati (foto o PDF). Sostituisce quella precedente. */
  app.put(
    '/me/passport/photo',
    { schema: { response: { 200: z.object({ passport: PassportDto }) } } },
    async (request) => {
      const file = requireFile(await readUpload(request, { accept: DOCUMENT_FILE_TYPES }));
      const userId = request.user.id;

      const storagePath = `users/${userId}/passport/${crypto.randomUUID()}.${extensionFor(file.type)}`;
      await app.storage.upload(storagePath, file.bytes, file.type);

      let previousPath: string | null;
      let user: User;
      try {
        ({ passportPhotoPath: previousPath } = await app.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { passportPhotoPath: true },
        }));
        user = await app.prisma.user.update({
          where: { id: userId },
          data: { passportPhotoPath: storagePath },
        });
      } catch (error) {
        await removeStoredFiles(app.storage, request.log, [storagePath]);
        throw error;
      }

      await removeStoredFiles(app.storage, request.log, [previousPath]);
      return { passport: toPassportDto(user)! };
    },
  );

  app.get('/me/passport/photo/url', { schema: { response: { 200: SignedUrlDto } } }, async (request) => {
    const { passportPhotoPath } = await app.prisma.user.findUniqueOrThrow({
      where: { id: request.user.id },
      select: { passportPhotoPath: true },
    });
    if (!passportPhotoPath) throw notFound('Passport photo');

    const expiresInSeconds = app.config.SIGNED_URL_TTL_SECONDS;
    return { url: await app.storage.createSignedUrl(passportPhotoPath, expiresInSeconds), expiresInSeconds };
  });

  app.delete('/me/passport/photo', async (request, reply) => {
    const { passportPhotoPath } = await app.prisma.user.findUniqueOrThrow({
      where: { id: request.user.id },
      select: { passportPhotoPath: true },
    });
    if (!passportPhotoPath) throw notFound('Passport photo');

    await app.prisma.user.update({ where: { id: request.user.id }, data: { passportPhotoPath: null } });
    await removeStoredFiles(app.storage, request.log, [passportPhotoPath]);
    return reply.status(204).send();
  });
};
