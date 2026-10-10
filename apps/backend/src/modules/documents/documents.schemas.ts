import { z } from 'zod';

import type { Document } from '../../generated/prisma/client.js';
import { DocumentKind } from '../../generated/prisma/enums.js';
import { isoDateTime } from '../../lib/schemas.js';

/**
 * Il documento come lo vede il client: tutto tranne il percorso nel bucket.
 * Il file si apre con `GET …/documents/:id/url`, che restituisce un URL firmato.
 */
export const DocumentDto = z.object({
  id: z.uuid(),
  kind: z.enum(DocumentKind),
  title: z.string(),
  subtitle: z.string(),
  code: z.string(),
  hasFile: z.boolean(),
  originalName: z.string().nullable(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nullable(),
  createdAt: isoDateTime,
});

export const toDocumentDto = (document: Document): z.output<typeof DocumentDto> => ({
  ...document,
  hasFile: document.storagePath !== null,
});

/** Nei body degli slot: `undefined` = non toccare, `null` = stacca, uuid = collega. */
export const DocumentRefInput = z.uuid().nullable().optional();

export const DocumentParams = z.object({ tripId: z.uuid(), documentId: z.uuid() });

/** Metadati che accompagnano il file nella stessa richiesta multipart. */
export const DocumentUploadFields = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  subtitle: z.string().trim().max(120).default(''),
  code: z.string().trim().max(64).default(''),
});

/** Un QR senza file: il contenuto è il codice stesso. */
export const QrDocumentBody = z.object({
  kind: z.literal('qr'),
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(120).default(''),
  code: z.string().trim().min(1).max(512),
});

export const SignedUrlDto = z.object({
  url: z.url(),
  expiresInSeconds: z.number().int().positive(),
});
