import { describe, expect, it } from 'vitest';

import { sniffFileType } from '../../src/lib/file-types.js';
import { HEIC, HTML, JPEG, MP4, PDF, PNG } from '../helpers/files.js';

describe('sniffFileType', () => {
  it.each([
    ['PDF', PDF, 'application/pdf'],
    ['PNG', PNG, 'image/png'],
    ['JPEG', JPEG, 'image/jpeg'],
    ['HEIC', HEIC, 'image/heic'],
    ['MP4', MP4, 'video/mp4'],
    [
      'QuickTime',
      Buffer.concat([Buffer.from([0, 0, 0, 0x14]), Buffer.from('ftypqt  '), Buffer.alloc(8)]),
      'video/quicktime',
    ],
    ['WebP', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]), 'image/webp'],
  ])('recognises %s from its first bytes', (_name, bytes, type) => {
    expect(sniffFileType(bytes)).toBe(type);
  });

  it.each([
    ['an HTML page', HTML],
    ['a Windows executable', Buffer.from('MZ\x90\x00\x03\x00')],
    ['plain text', Buffer.from('voucher')],
    [
      'an unknown ISO container',
      Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypcrx '), Buffer.alloc(8)]),
    ],
    ['a few bytes', Buffer.from([0xff])],
  ])('rejects %s', (_name, bytes) => {
    expect(sniffFileType(bytes)).toBeNull();
  });
});
