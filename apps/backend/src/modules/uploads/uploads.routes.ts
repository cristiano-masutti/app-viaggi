import crypto from 'node:crypto';
import path from 'node:path';

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { AssetDto, AssetParams, SignedUrlDto, UploadQuery } from './uploads.schemas.js';

const MAX_ORIGINAL_NAME_LENGTH = 255;

/** Il nome sul bucket è un UUID: del nome originale si tiene solo un'estensione plausibile. */
const safeExtension = (filename: string) => {
  const extension = path.extname(filename).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '';
};

export const uploadRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/uploads',
    { schema: { querystring: UploadQuery, response: { 201: z.object({ asset: AssetDto }) } } },
    async (request, reply) => {
      if (!request.isMultipart()) {
        throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected a multipart/form-data request');
      }

      const trip = await app.prisma.trip.findUnique({
        where: { id: request.query.tripId },
        select: { id: true },
      });
      if (!trip) throw notFound('Trip');

      const file = await request.file();
      if (!file) throw badRequest('FILE_REQUIRED', 'A multipart file field is required');

      // Oltre `UPLOAD_MAX_BYTES` lancia un 413, gestito dall'error handler.
      const bytes = await file.toBuffer();
      if (bytes.length === 0) throw badRequest('EMPTY_FILE', 'The uploaded file is empty');

      const storagePath = `trips/${trip.id}/${crypto.randomUUID()}${safeExtension(file.filename)}`;
      await app.storage.upload(storagePath, bytes, file.mimetype);

      try {
        const asset = await app.prisma.tripAsset.create({
          data: {
            tripId: trip.id,
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
    '/uploads/:assetId/signed-url',
    { schema: { params: AssetParams, response: { 200: SignedUrlDto } } },
    async (request) => {
      const asset = await app.prisma.tripAsset.findUnique({
        where: { id: request.params.assetId },
        select: { id: true, storagePath: true },
      });
      if (!asset) throw notFound('Asset');

      const expiresInSeconds = app.config.SIGNED_URL_TTL_SECONDS;
      const signedUrl = await app.storage.createSignedUrl(asset.storagePath, expiresInSeconds);

      return { assetId: asset.id, signedUrl, expiresInSeconds };
    },
  );
};
