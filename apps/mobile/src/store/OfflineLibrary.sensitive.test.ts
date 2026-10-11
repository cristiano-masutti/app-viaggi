import { describe, expect, it, jest } from '@jest/globals';

import type { DocumentRef, Trip } from '@/types';

import { collectTripDocuments } from './OfflineLibrary';

// L'app costruita con EXPO_PUBLIC_SENSITIVE_DATA=off.
jest.mock('@/config', () => ({ ...jest.requireActual<object>('@/config'), sensitiveData: false }));
jest.mock('@/store/AppStore', () => ({}));
jest.mock('@/lib/offlineDocuments', () => ({}));

const doc = (id: string): DocumentRef => ({ id, kind: 'pdf', title: id, subtitle: '', code: '', uri: `api:${id}` });

describe('collectTripDocuments with sensitive data off', () => {
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
});
