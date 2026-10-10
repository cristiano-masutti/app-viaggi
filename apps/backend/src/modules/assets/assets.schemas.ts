import { z } from 'zod';

import { isoDateTime } from '../../lib/schemas.js';

export const AssetParams = z.object({ tripId: z.uuid(), assetId: z.uuid() });

/** `storagePath` resta interno: il client arriva al file solo con un URL firmato. */
export const AssetDto = z.object({
  id: z.uuid(),
  tripId: z.uuid(),
  uploadedById: z.uuid().nullable(),
  originalName: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: isoDateTime,
});

export const SignedUrlDto = z.object({
  assetId: z.uuid(),
  signedUrl: z.url(),
  expiresInSeconds: z.number().int().positive(),
});
