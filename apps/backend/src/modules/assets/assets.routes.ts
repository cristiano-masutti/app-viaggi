import crypto from 'node:crypto';
import path from 'node:path';

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { TripParams } from '../trips/trip-access.js';
import { AssetDto, AssetParams, SignedUrlDto } from './assets.schemas.js';

const MAX_ORIGINAL_NAME_LENGTH = 255;

/** Il nome sul bucket è un UUID: del nome originale si tiene solo un'estensione plausibile. */
const safeExtension = (filename: string) => {
  const extension = path.extname(filename).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
};

/**
 * File del viaggio (voucher, biglietti, polizze). Vive dentro `tripScope`:
 * quando un handler parte, l'utente è già membro del viaggio con un ruolo ammesso.
 */
export const assetRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Caricare documenti è organizzare il viaggio: lo fa il coordinatore. */
  app.post(
    '/trips/:tripId/assets',
    {
      config: { tripRoles: [TripRole.COORDINATOR] },
      schema: { params: TripParams, response: { 201: z.object({ asset: AssetDto }) } },
    },
    async (request, reply) => {
      if (!request.isMultipart()) {
        throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected a multipart/form-data request');
      }

      const { tripId } = request.params;
      const file = await request.file();
      if (!file) throw badRequest('FILE_REQUIRED', 'A multipart file field is required');

      // Oltre `UPLOAD_MAX_BYTES` lancia un 413, gestito dall'error handler.
      const bytes = await file.toBuffer();
      if (bytes.length === 0) throw badRequest('EMPTY_FILE', 'The uploaded file is empty');

      const storagePath = `trips/${tripId}/${crypto.randomUUID()}${safeExtension(file.filename)}`;
      await app.storage.upload(storagePath, bytes, file.mimetype);

      try {
        const asset = await app.prisma.tripAsset.create({
          data: {
            tripId,
            uploadedById: request.user.id,
            originalName: (file.filename || 'file').slice(0, MAX_ORIGINAL_NAME_LENGTH),
            mimeType: file.mimetype,
            sizeBytes: bytes.length,
            storagePath,
          },
        });
        return reply.status(201).send({ asset });
      } catch (error) {
        // Senza la riga a database il file sul bucket non è raggiungibile da
        // nessuno: lo si toglie subito invece di lasciarlo orfano.
        await app.storage.remove([storagePath]).catch((removeError: unknown) => {
          request.log.error({ err: removeError, storagePath }, 'Failed to remove orphaned upload');
        });
        throw error;
      }
    },
  );

  app.get(
    '/trips/:tripId/assets/:assetId/signed-url',
    { schema: { params: AssetParams, response: { 200: SignedUrlDto } } },
    async (request) => {
      const { tripId, assetId } = request.params;

      // Il filtro su tripId è il controllo d'accesso: un asset di un altro
      // viaggio, anche se l'id è giusto, qui non esiste.
      const asset = await app.prisma.tripAsset.findFirst({
        where: { id: assetId, tripId },
        select: { id: true, storagePath: true },
      });
      if (!asset) throw notFound('Asset');

      const expiresInSeconds = app.config.SIGNED_URL_TTL_SECONDS;
      const signedUrl = await app.storage.createSignedUrl(asset.storagePath, expiresInSeconds);

      return { assetId: asset.id, signedUrl, expiresInSeconds };
    },
  );
};
