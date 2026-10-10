import crypto from 'node:crypto';

import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { DocumentKind } from '../../generated/prisma/enums.js';
import { AppError, notFound } from '../../lib/errors.js';
import { DOCUMENT_FILE_TYPES, extensionFor } from '../../lib/file-types.js';
import { readUpload, requireFile } from '../../lib/multipart.js';
import { parseOrThrow } from '../../lib/validation.js';
import { removeStoredFiles } from '../../storage/cleanup.js';
import { COORDINATOR_ONLY, MEMBERS_AND_STAFF, TripParams } from '../trips/trip-access.js';
import {
  DocumentDto,
  DocumentParams,
  DocumentUploadFields,
  QrDocumentBody,
  SignedUrlDto,
  toDocumentDto,
} from './documents.schemas.js';

/**
 * Documenti del viaggio. Il flusso è in due passi: qui si carica il file e si
 * ottiene un id, poi lo si collega allo slot giusto (alloggio, attività, mezzo…)
 * passando `documentId` nel body di quello slot.
 */
export const documentRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/trips/:tripId/documents',
    {
      config: COORDINATOR_ONLY,
      schema: { params: TripParams, response: { 201: z.object({ document: DocumentDto }) } },
    },
    async (request, reply) => {
      const { tripId } = request.params;
      const uploadedById = request.user.id;

      // Un QR può non avere file: arriva come JSON con il solo codice.
      if (!request.isMultipart()) {
        const qr = parseOrThrow(QrDocumentBody, request.body, 'body');
        const document = await app.prisma.document.create({
          data: { ...qr, tripId, uploadedById, kind: DocumentKind.qr },
        });
        return reply.status(201).send({ document: toDocumentDto(document) });
      }

      const upload = await readUpload(request, { accept: DOCUMENT_FILE_TYPES });
      const file = requireFile(upload);
      const fields = parseOrThrow(DocumentUploadFields, upload.fields, 'fields');

      const storagePath = `trips/${tripId}/documents/${crypto.randomUUID()}.${extensionFor(file.type)}`;
      await app.storage.upload(storagePath, file.bytes, file.type);

      try {
        const document = await app.prisma.document.create({
          data: {
            tripId,
            uploadedById,
            kind: file.type === 'application/pdf' ? DocumentKind.pdf : DocumentKind.image,
            title: fields.title ?? file.originalName,
            subtitle: fields.subtitle,
            code: fields.code,
            originalName: file.originalName,
            mimeType: file.type,
            sizeBytes: file.bytes.length,
            storagePath,
          },
        });
        return reply.status(201).send({ document: toDocumentDto(document) });
      } catch (error) {
        // Senza la riga a database il file sul bucket non è raggiungibile da nessuno.
        await removeStoredFiles(app.storage, request.log, [storagePath]);
        throw error;
      }
    },
  );

  app.get(
    '/trips/:tripId/documents/:documentId/url',
    { config: MEMBERS_AND_STAFF, schema: { params: DocumentParams, response: { 200: SignedUrlDto } } },
    async (request) => {
      const { tripId, documentId } = request.params;

      // Il filtro su tripId è il controllo d'accesso: un documento di un altro
      // viaggio, anche con l'id giusto, qui non esiste.
      const document = await app.prisma.document.findFirst({
        where: { id: documentId, tripId },
        select: { storagePath: true },
      });
      if (!document?.storagePath) throw notFound('Document file');

      const expiresInSeconds = app.config.SIGNED_URL_TTL_SECONDS;
      const url = await app.storage.createSignedUrl(document.storagePath, expiresInSeconds);
      return { url, expiresInSeconds };
    },
  );

  /** Per ripulire un upload rimasto senza slot (es. il salvataggio dello slot è fallito). */
  app.delete(
    '/trips/:tripId/documents/:documentId',
    { config: COORDINATOR_ONLY, schema: { params: DocumentParams } },
    async (request, reply) => {
      const { tripId, documentId } = request.params;

      const document = await app.prisma.document.findFirst({ where: { id: documentId, tripId } });
      if (!document) throw notFound('Document');

      // La condizione su `attached` è nella delete stessa: uno slot che lo
      // collega nel frattempo vince, e qui non si cancella nulla.
      const { count } = await app.prisma.document.deleteMany({
        where: { id: documentId, attached: false },
      });
      if (count === 0) {
        throw new AppError(409, 'DOCUMENT_ATTACHED', 'Detach the document from its slot to remove it');
      }

      await removeStoredFiles(app.storage, request.log, [document.storagePath]);
      return reply.status(204).send();
    },
  );
};
