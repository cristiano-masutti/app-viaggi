import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import React from 'react';

import { PROFILE_PASSPORT_DOC_ID } from '@/lib/documentIds';
import type { DocumentRef, Trip } from '@/types';

import { collectTripDocuments, OfflineLibraryProvider } from './OfflineLibrary';

// L'app costruita con EXPO_PUBLIC_SENSITIVE_DATA=off.
jest.mock('@/config', () => ({ ...jest.requireActual<object>('@/config'), sensitiveData: false }));

// Un account senza documenti di viaggio: la pulizia degli orfani non parte.
jest.mock('@/store/AppStore', () => ({
  useAppState: () => ({ authenticated: true, trips: [], profile: { passport: { number: '', photoUri: '' } } }),
  useFileUrlResolver: () => async (uri: string) => uri,
}));

const mockDiscardAllVersions = jest.fn();
jest.mock('@/lib/offlineDocuments', () => ({
  OFFLINE_STORAGE_SUPPORTED: true,
  offlineKey: (doc: DocumentRef) => doc.id,
  storedDocument: () => null,
  saveForOffline: () => new Promise(() => undefined),
  discardStoredDocument: () => undefined,
  pruneOrphans: () => 0,
  discardAllVersions: (id: string) => mockDiscardAllVersions(id),
}));

const doc = (id: string): DocumentRef => ({ id, kind: 'pdf', title: id, subtitle: '', code: '', uri: `api:${id}` });

describe('offline library with sensitive data off', () => {
  it('keeps the vouchers on the phone, never the passport scan', () => {
    const trip = {
      days: [{ id: 'G1', index: 1, stay: { name: 'Hotel', address: 'Vík', doc: doc('voucher') }, activities: [] }],
      documents: {
        passport: { number: 'YA9182773', expiry: '04/2029', doc: doc('passport') },
        customs: null,
        transports: [],
        insurance: { company: 'Europ', coverage: '', policy: '', emergencyPhone: '', doc: doc('policy') },
      },
    } as unknown as Trip;

    expect(collectTripDocuments(trip).map((entry) => entry.id)).toEqual(['voucher', 'policy']);
  });

  it('deletes a passport scan saved by an earlier build, even with no other document', async () => {
    await render(
      <OfflineLibraryProvider>
        <></>
      </OfflineLibraryProvider>,
    );

    expect(mockDiscardAllVersions).toHaveBeenCalledWith(PROFILE_PASSPORT_DOC_ID);
  });
});
