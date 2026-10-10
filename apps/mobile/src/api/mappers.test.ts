import { describe, expect, it } from '@jest/globals';

import {
  dayIndexOf,
  displayName,
  signedUrlPathFor,
  toApiMood,
  toApiReaction,
  toCreateTripBody,
  toMemory,
  toProfilePatch,
  toUserProfile,
  tripFromDetail,
  tripFromSummary,
  tripTimeline,
} from '@/api/mappers';
import type { MemberDto, MemoryDto, ProfileDto, TripDetailDto, TripSummaryDto } from '@/api/types';
import { crewLabel, tripBadge, tripMeta } from '@/lib/trip';

const sofia: MemberDto = {
  userId: '11111111-1111-4111-8111-111111111111',
  firstName: 'Sofia',
  lastName: 'Marchi',
  username: 'sofiam',
  role: 'coordinator',
  joinedAt: '2026-08-01T10:00:00.000Z',
};
const luca: MemberDto = { ...sofia, userId: '22222222-2222-4222-8222-222222222222', firstName: 'Luca', lastName: 'Tosi', username: null, role: 'traveller' };

const summary: TripSummaryDto = {
  id: 'trip-1',
  title: 'Islanda On The Road 🇮🇸',
  destination: 'Islanda',
  startDate: '2026-09-14',
  endDate: '2026-09-23',
  totalDays: 10,
  crewCapacity: 10,
  inviteCode: 'islanda-on-the-road-k7m2x9p4q3ra',
  myRole: 'traveller',
  crew: [sofia, luca],
  pendingInvitations: 1,
  mediaCount: 12,
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

const pdf = {
  id: 'doc-1',
  kind: 'pdf' as const,
  title: 'Voucher',
  subtitle: 'Hotel Kría',
  code: 'HK-2231',
  hasFile: true,
  originalName: 'voucher.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1024,
  createdAt: '2026-08-02T10:00:00.000Z',
};

const detail: TripDetailDto = {
  ...summary,
  crew: [sofia, luca],
  invitations: [{ id: 'inv-1', name: 'Aisha B.', email: 'aisha@example.test', createdAt: '2026-08-01T10:00:00.000Z' }],
  days: Array.from({ length: 10 }, (_, offset) => ({
    index: offset + 1,
    date: `2026-09-${14 + offset}`,
    stay: offset === 2 ? { name: 'Hotel Kría', address: 'Vík', doc: pdf, updatedAt: '2026-08-02T10:00:00.000Z' } : null,
    activities:
      offset === 2
        ? [{ id: 'act-1', dayIndex: 3, name: 'Ghiacciaio', place: 'Sólheimajökull', position: 0, doc: null }]
        : [],
  })),
  documents: {
    passport: { number: 'YA9182773', expiry: '04/2029', hasPhoto: true, photoVersion: 'a1b2c3d4e5f60718' },
    customs: null,
    insurance: { company: 'Europ Assistance', policy: 'VM-1', coverage: 'fino al 24/09', emergencyPhone: '+390258286666', doc: null },
    transports: [
      {
        id: 'trn-1',
        name: 'Van 4x4',
        reference: 'AB-123',
        mode: 'van',
        docs: [{ id: 'td-1', label: 'Contratto', doc: { ...pdf, id: 'doc-qr', kind: 'qr', hasFile: false } }],
      },
    ],
  },
  emergencies: [{ id: 'sos-1', title: '🚨 112', subtitle: '', actionLabel: 'Chiama 112', phone: '112', whatsapp: false }],
};

describe('tripTimeline', () => {
  it.each([
    ['2026-09-13', { status: 'upcoming' }],
    ['2026-09-14', { status: 'ongoing', currentDay: 1 }],
    ['2026-09-16', { status: 'ongoing', currentDay: 3 }],
    ['2026-09-23', { status: 'ongoing', currentDay: 10 }],
    ['2026-09-24', { status: 'past' }],
  ])('on %s the trip is %j', (today, expected) => {
    expect(tripTimeline('2026-09-14', '2026-09-23', today)).toEqual(expected);
  });
});

describe('tripFromSummary', () => {
  it('builds the hub card with the coordinator first and the media count', () => {
    const trip = tripFromSummary(summary, '2026-09-16');

    expect(trip).toMatchObject({ status: 'ongoing', currentDay: 3, mediaCount: 12, crewCapacity: 10 });
    expect(trip.coordinator).toMatchObject({ name: 'Sofia M.', handle: '@sofiam', role: 'coordinator' });
    expect(tripBadge(trip)).toBe('LIVE • GIORNO 3 DI 10');
    expect(crewLabel(trip)).toBe('2 confermati su 10 posti');
  });

  it('counts the media of a past trip without loading its memories', () => {
    expect(tripMeta(tripFromSummary(summary, '2026-10-01'))).toBe('Settembre 2026 · 10 giorni · 12 ricordi');
  });
});

describe('tripFromDetail', () => {
  const trip = tripFromDetail(detail, '2026-09-01');

  it('adds the reserved places to the crew as not yet confirmed', () => {
    expect(trip.crew.map(({ name, confirmed }) => [name, confirmed])).toEqual([
      ['Sofia M.', true],
      ['Luca T.', true],
      ['Aisha B.', false],
    ]);
    expect(crewLabel(trip)).toBe('2 confermati su 10 posti');
  });

  it('labels the days and keeps the programme on its day', () => {
    expect(trip.days).toHaveLength(10);
    expect(trip.days[2]).toMatchObject({
      id: 'G3',
      index: 3,
      label: 'G3',
      date: '16 Set',
      stay: { name: 'Hotel Kría', doc: { id: 'doc-1', uri: 'api:trips/trip-1/documents/doc-1' } },
      activities: [{ id: 'act-1', name: 'Ghiacciaio', doc: null }],
    });
  });

  it('points files at the API and leaves a QR without file to the phone', () => {
    expect(trip.documents.passport).toMatchObject({
      number: 'YA9182773',
      doc: { id: 'profile-passport-scan', uri: 'api:me/passport/photo?v=a1b2c3d4e5f60718' },
    });
    expect(trip.documents.transports[0]?.docs[0]?.doc).toMatchObject({ kind: 'qr', uri: '' });
    expect(trip.emergencies[0]).toEqual({ id: 'sos-1', title: '🚨 112', subtitle: '', actionLabel: 'Chiama 112', phone: '112', whatsapp: undefined });
  });
});

describe('signedUrlPathFor', () => {
  it.each([
    ['api:trips/t1/documents/d1', '/api/trips/t1/documents/d1/url'],
    ['api:trips/t1/memories/m1', '/api/trips/t1/memories/m1/media-url'],
    ['api:me/passport/photo', '/api/me/passport/photo/url'],
    ['api:me/passport/photo?v=a1b2c3d4e5f60718', '/api/me/passport/photo/url'],
    ['file:///var/mobile/voucher.pdf', null],
    ['api:trips/t1/../../admin', null],
  ])('%s → %s', (uri, path) => {
    expect(signedUrlPathFor(uri)).toBe(path);
  });
});

describe('memories', () => {
  const photo: MemoryDto = {
    id: 'mem-1',
    kind: 'video',
    dayIndex: 2,
    authorId: sofia.userId,
    visibility: 'crew',
    createdAt: '2026-09-15T16:42:00.000Z',
    caption: 'Skógafoss',
    aspectRatio: 0.75,
    blurhash: null,
    durationSeconds: 75,
    mimeType: 'video/mp4',
    mediaUrl: 'https://storage.test/signed/clip.mp4?token=abc',
    reactions: { fire: 2, love: 1 },
    myReaction: 'love',
  };

  it('maps a video with its reactions as emoji and the local time', () => {
    expect(toMemory('trip-1', photo)).toMatchObject({
      kind: 'video',
      dayId: 'G2',
      time: '18:42',
      uri: 'https://storage.test/signed/clip.mp4?token=abc',
      durationLabel: '1:15',
      reactions: { '🔥': 2, '❤️': 1 },
      myReaction: '❤️',
    });
  });

  it('maps a note with its mood label', () => {
    const note: MemoryDto = {
      id: 'mem-2',
      kind: 'note',
      dayIndex: 1,
      authorId: luca.userId,
      visibility: 'private',
      createdAt: '2026-09-14T08:05:00.000Z',
      text: 'Solo per me',
      mood: 'personal',
    };
    expect(toMemory('trip-1', note)).toEqual({
      id: 'mem-2',
      kind: 'note',
      dayId: 'G1',
      authorId: luca.userId,
      time: '10:05',
      visibility: 'private',
      text: 'Solo per me',
      mood: '🔒 Personale',
    });
  });

  it('translates reactions and moods back for the API', () => {
    expect(['🔥', '😂', '❤️', '🤯'].map((key) => toApiReaction(key as never))).toEqual(['fire', 'laugh', 'love', 'mindblown']);
    expect(toApiMood('📍 Posto')).toBe('place');
  });
});

describe('from the app to the API', () => {
  it('turns the CreateTripScreen draft into the create body', () => {
    expect(
      toCreateTripBody({
        title: '  Giappone Discovery 🇯🇵 ',
        startDate: '2026-11-01',
        endDate: '2026-11-12',
        coordinatorName: 'Sofia',
        coordinatorPhone: '+39 333 1234567',
        crewNames: ['Luca', ' ', 'Aisha'],
      }),
    ).toMatchObject({
      title: 'Giappone Discovery 🇯🇵',
      invitees: [{ name: 'Luca' }, { name: 'Aisha' }],
      emergencies: [
        { title: '📣 Sofia • Coordinatore', phone: '+39 333 1234567', whatsapp: true },
        { title: '🚨 112 • Numero Unico Emergenze', phone: '112' },
      ],
    });
  });

  it('sends only the profile fields that live on the server', () => {
    expect(
      toProfilePatch({ bio: 'Nuova bio', biometricUnlock: true, avatar: 'file:///a.jpg', passport: { number: '', expiry: '', photoUri: '' } }),
    ).toEqual({ bio: 'Nuova bio', passport: null });
  });

  it('keeps device-only settings when reading the profile', () => {
    const dto: ProfileDto = {
      id: 'u1',
      email: 'marco@example.test',
      firstName: 'Marco',
      lastName: 'Rossi',
      username: 'marcorossi',
      bio: '',
      fiscalCode: null,
      diet: '',
      medicalNotes: '',
      passport: null,
      createdAt: '2026-08-01T10:00:00.000Z',
    };
    expect(toUserProfile(dto, { avatar: 'file:///a.jpg', biometricUnlock: true })).toMatchObject({
      username: '@marcorossi',
      avatar: 'file:///a.jpg',
      biometricUnlock: true,
      passport: { number: '', expiry: '', photoUri: '' },
    });
  });

  it('reads day ids and names', () => {
    expect(dayIndexOf('G12')).toBe(12);
    expect(() => dayIndexOf('X')).toThrow();
    expect(displayName({ firstName: '', lastName: '', username: null })).toBe('Viaggiatore');
    expect(displayName({ firstName: '', lastName: '', username: 'nico' })).toBe('@nico');
  });
});
