import { describe, expect, it } from '@jest/globals';

import { apiFileUri } from '@/api/mappers';
import { PROFILE_PASSPORT_DOC_ID } from '@/lib/documentIds';
import type { DocumentRef } from '@/types';

import { offlineKey } from './offlineDocuments';

const passportScan = (version: string): DocumentRef => ({
  id: PROFILE_PASSPORT_DOC_ID,
  kind: 'image',
  title: 'Passaporto',
  subtitle: 'Pagina dati',
  code: '',
  uri: apiFileUri.passport(version),
});

describe('offlineKey', () => {
  it('stays the same for the same file, so nothing is downloaded twice', () => {
    expect(offlineKey(passportScan('a1b2'))).toBe(offlineKey(passportScan('a1b2')));
  });

  it('changes when the passport scan is replaced, under the same id', () => {
    expect(offlineKey(passportScan('a1b2'))).not.toBe(offlineKey(passportScan('c3d4')));
  });

  it('is a safe file name', () => {
    expect(offlineKey(passportScan('a1b2'))).toMatch(/^[\w-]+$/);
  });
});
