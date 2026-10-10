/**
 * File minimi ma riconoscibili: i primi byte sono quelli veri del formato,
 * quindi passano (o non passano) dallo stesso controllo dei file reali.
 */
export const PDF = Buffer.from('%PDF-1.7\n% voucher di prova\n');
export const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('IHDR-di-prova'),
]);
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('JFIF-di-prova')]);
export const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic'), Buffer.alloc(12)]);
export const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(12)]);
export const HTML = Buffer.from('<!doctype html><script>alert(1)</script>');

interface FileFormOptions {
  filename?: string;
  /** Il content-type dichiarato dal client: il server non ci crede. */
  type?: string;
  fields?: Record<string, string | number>;
}

/** Richiesta multipart: prima i campi, poi il file nel campo `file`. */
export function fileForm(
  bytes: Buffer,
  { filename = 'file.bin', type = 'application/octet-stream', fields = {} }: FileFormOptions = {},
) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, String(value));
  form.append('file', new Blob([new Uint8Array(bytes)], { type }), filename);
  return form;
}
