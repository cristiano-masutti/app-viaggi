/**
 * Riconosce il tipo di un file dai suoi primi byte, non da quello che dichiara
 * il client: un file che si spaccia per PDF ma è una pagina HTML non entra nel
 * bucket. Il content-type salvato è sempre quello riconosciuto qui.
 */
export const FILE_TYPES = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
} as const;

export type FileType = keyof typeof FILE_TYPES;

export const DOCUMENT_FILE_TYPES: readonly FileType[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];

export const IMAGE_FILE_TYPES: readonly FileType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

export const MEDIA_FILE_TYPES: readonly FileType[] = [...IMAGE_FILE_TYPES, 'video/mp4', 'video/quicktime'];

const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const ascii = (bytes: Buffer, start: number, end: number) => bytes.subarray(start, end).toString('latin1');

export function sniffFileType(bytes: Buffer): FileType | null {
  if (ascii(bytes, 0, 5) === '%PDF-') return 'application/pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';

  // Contenitori ISO BMFF (HEIC, MP4, MOV): "ftyp" e poi il brand principale.
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (HEIF_BRANDS.has(brand)) return 'image/heic';
    if (brand === 'qt  ') return 'video/quicktime';
    if (/^(isom|iso\d|mp4\d|avc1|M4V |dash|3gp\d)$/.test(brand)) return 'video/mp4';
  }

  return null;
}

export const extensionFor = (type: FileType) => FILE_TYPES[type];
