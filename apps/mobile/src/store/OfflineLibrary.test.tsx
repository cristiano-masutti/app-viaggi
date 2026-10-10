import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import React from 'react';

import type { DocumentRef, Trip } from '@/types';

import { OfflineLibraryProvider, useOfflineDocument } from './OfflineLibrary';

/*
 * La biblioteca offline senza disco e senza store: i file sono in una mappa,
 * lo stato dell'account lo decide il test.
 */
const mockDisk = new Map<string, string>();
const mockState = { authenticated: true, trips: [] as Trip[], profile: { passport: { number: '', photoUri: '' } } };
let mockDownload: { resolve: () => void } | null = null;

jest.mock('@/store/AppStore', () => ({
  useAppState: () => mockState,
  useFileUrlResolver: () => async (uri: string) => uri,
}));

jest.mock('@/lib/offlineDocuments', () => ({
  OFFLINE_STORAGE_SUPPORTED: true,
  offlineKey: (doc: DocumentRef) => `${doc.id}-${doc.uri}`,
  storedDocument: (doc: DocumentRef) => (mockDisk.has(doc.id) ? { uri: `file:///${doc.id}`, bytes: 1 } : null),
  saveForOffline: (doc: DocumentRef) =>
    new Promise((resolve) => {
      mockDownload = {
        resolve: () => {
          mockDisk.set(doc.id, doc.uri);
          resolve({ uri: `file:///${doc.id}`, bytes: 1 });
        },
      };
    }),
  discardStoredDocument: (doc: DocumentRef) => mockDisk.delete(doc.id),
  pruneOrphans: (documents: DocumentRef[]) => {
    const keep = new Set(documents.map((doc) => doc.id));
    for (const id of [...mockDisk.keys()]) if (!keep.has(id)) mockDisk.delete(id);
    return 0;
  },
}));

const voucher: DocumentRef = { id: 'doc-1', kind: 'pdf', title: 'Voucher', subtitle: '', code: '', uri: 'api:trips/t/documents/doc-1' };
const tripWith = (doc: DocumentRef) =>
  ({
    id: 't',
    days: [{ id: 'G1', index: 1, stay: { name: 'Hotel', address: 'Vík', doc }, activities: [] }],
    documents: { passport: null, customs: null, transports: [], insurance: null },
  }) as unknown as Trip;

let observed: string | undefined;
function Probe() {
  observed = useOfflineDocument('doc-1').state;
  return null;
}

const mount = async () =>
  await render(
    <OfflineLibraryProvider>
      <Probe />
    </OfflineLibraryProvider>,
  );

beforeEach(() => {
  mockDisk.clear();
  mockDownload = null;
  observed = undefined;
  Object.assign(mockState, { authenticated: true, trips: [tripWith(voucher)] });
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('OfflineLibraryProvider', () => {
  it('saves the documents of the trips on the phone by itself', async () => {
    await mount();
    expect(observed).toBe('saving');

    await act(async () => mockDownload?.resolve());

    expect(observed).toBe('saved');
    expect(mockDisk.has('doc-1')).toBe(true);
  });

  it('removes every document of the account when it signs out, as the confirmation promises', async () => {
    const screen = await mount();
    await act(async () => mockDownload?.resolve());

    Object.assign(mockState, { authenticated: false, trips: [] });
    await screen.rerender(
      <OfflineLibraryProvider>
        <Probe />
      </OfflineLibraryProvider>,
    );

    expect(mockDisk.size).toBe(0);
    // Nessuna voce: per il documento non c'è più niente sul telefono.
    expect(observed).toBe('queued');
  });

  it('throws away a download that finishes after the sign out', async () => {
    const screen = await mount();
    Object.assign(mockState, { authenticated: false, trips: [] });
    await screen.rerender(
      <OfflineLibraryProvider>
        <Probe />
      </OfflineLibraryProvider>,
    );

    await act(async () => mockDownload?.resolve());

    expect(mockDisk.size).toBe(0);
    // Nessuna voce: per il documento non c'è più niente sul telefono.
    expect(observed).toBe('queued');
  });

  it('keeps the saved documents when the app starts on the login screen', async () => {
    mockDisk.set('doc-1', voucher.uri);
    Object.assign(mockState, { authenticated: false, trips: [] });

    await mount();

    expect(mockDisk.has('doc-1')).toBe(true);
  });
});
