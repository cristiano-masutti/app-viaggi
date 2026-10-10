import type { FastifyRequest } from 'fastify';

import { AppError, badRequest } from './errors.js';
import { type FileType, sniffFileType } from './file-types.js';

export interface UploadedFile {
  originalName: string;
  /** Riconosciuto dal contenuto, non dichiarato dal client. */
  type: FileType;
  bytes: Buffer;
}

export interface MultipartUpload {
  fields: Record<string, string>;
  file: UploadedFile | null;
}

export const expectMultipart = (request: FastifyRequest) => {
  if (!request.isMultipart()) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Expected a multipart/form-data request');
  }
};

/**
 * Legge una richiesta multipart con al più un file (il limite di dimensione è
 * quello del plugin: oltre, 413). Il file è accettato solo se il suo contenuto
 * è di uno dei tipi ammessi.
 */
export async function readUpload(
  request: FastifyRequest,
  { accept }: { accept: readonly FileType[] },
): Promise<MultipartUpload> {
  expectMultipart(request);

  const fields: Record<string, string> = {};
  let file: UploadedFile | null = null;

  for await (const part of request.parts()) {
    if (part.type === 'field') {
      fields[part.fieldname] = typeof part.value === 'string' ? part.value : String(part.value);
      continue;
    }

    const bytes = await part.toBuffer();
    if (bytes.length === 0) throw badRequest('EMPTY_FILE', 'The uploaded file is empty');

    const type = sniffFileType(bytes);
    if (!type || !accept.includes(type)) {
      throw new AppError(415, 'UNSUPPORTED_FILE_TYPE', 'This kind of file is not accepted here', {
        details: { accepted: accept },
      });
    }

    file = { originalName: (part.filename || 'file').slice(0, 255), type, bytes };
  }

  return { fields, file };
}

export function requireFile(upload: MultipartUpload): UploadedFile {
  if (!upload.file) throw badRequest('FILE_REQUIRED', 'A multipart file field is required');
  return upload.file;
}
