import { describe, expect, it, jest } from '@jest/globals';

import { ApiError } from '@/api/client';
import type { ProfileDto } from '@/api/types';
import type { RemoteData } from '@/data/remote';
import type { DocumentRef, Trip } from '@/types';

import { createRemoteActions, describeError } from './remoteActions';
import { type AppState, EMPTY_PROFILE, reducer, remoteInitialState } from './state';

const TRIP_ID = '11111111-1111-4111-8111-111111111111';
const ACTIVITY_ID = '22222222-2222-4222-8222-222222222222';
const DOC_ID = '33333333-3333-4333-8333-333333333333';
const MEMORY_ID = '44444444-4444-4444-8444-444444444444';

const serverDoc: DocumentRef = {
  id: DOC_ID,
  kind: 'pdf',
  title: 'Voucher',
  subtitle: 'voucher.pdf',
  code: 'HK-1',
  uri: `api:trips/${TRIP_ID}/documents/${DOC_ID}`,
};
const pickedDoc: DocumentRef = { ...serverDoc, id: 'doc-local-1', uri: 'file:///cache/nuovo-voucher.pdf' };

function tripFixture(overrides: Partial<Trip> = {}): Trip {
  return {
    id: TRIP_ID,
    status: 'upcoming',
    title: 'Islanda',
    coverBlurhash: 'L',
    startDate: '2026-09-14',
    endDate: '2026-09-16',
    totalDays: 3,
    coordinator: { id: 'u1', name: 'Sofia M.', handle: '@sofiam', role: 'coordinator', confirmed: true },
    crew: [],
    inviteCode: 'islanda-abcdefghjkmn',
    days: [1, 2, 3].map((index) => ({
      id: `G${index}`,
      index,
      label: `G${index}`,
      date: `${13 + index} Set`,
      stay: index === 1 ? { name: 'Hotel Kría', address: 'Vík', doc: serverDoc } : null,
      activities:
        index === 2 ? [{ id: ACTIVITY_ID, name: 'Ghiacciaio', place: 'Sólheimajökull', doc: null }] : [],
    })),
    documents: { passport: null, customs: null, transports: [], insurance: null },
    emergencies: [],
    memories: [
      {
        id: MEMORY_ID,
        kind: 'photo',
        dayId: 'G1',
        authorId: 'u1',
        time: '18:42',
        visibility: 'crew',
        uri: 'https://storage.test/x.jpg',
        blurhash: 'L',
        aspectRatio: 1,
        reactions: { '🔥': 1 },
        myReaction: null,
      },
    ],
    ...overrides,
  };
}

const profileDto: ProfileDto = {
  id: 'u1',
  email: 'sofia@example.test',
  firstName: 'Sofia',
  lastName: 'Marchi',
  username: 'sofiam',
  bio: '',
  fiscalCode: null,
  diet: '',
  medicalNotes: '',
  passport: null,
  createdAt: '2026-08-01T10:00:00.000Z',
};

/** Il backend finto: ogni metodo è uno spy; `trip()` restituisce ciò che "il server" ha. */
function setup(initial: Partial<AppState> = {}) {
  let state: AppState = {
    ...remoteInitialState,
    authenticated: true,
    profile: { ...EMPTY_PROFILE, id: 'u1' },
    tripsStatus: 'ready',
    trips: [tripFixture()],
    loadedTrips: { [TRIP_ID]: true },
    ...initial,
  };
  const serverTrip = { current: tripFixture() };
  const notices: string[] = [];
  const ok = () => jest.fn(async (..._args: unknown[]) => ({}));

  const data = {
    profile: jest.fn(async () => profileDto),
    trips: jest.fn(async () => [tripFixture()]),
    trip: jest.fn(async (_id: string) => serverTrip.current),
    createTrip: jest.fn(async () => tripFixture({ id: '55555555-5555-4555-8555-555555555555' })),
    updateProfile: jest.fn(async () => profileDto),
    uploadPassportPhoto: ok(),
    uploadDocument: jest.fn(async () => 'uploaded-doc-id'),
    putStay: ok(),
    deleteStay: ok(),
    createActivity: ok(),
    updateActivity: ok(),
    deleteActivity: ok(),
    createTransport: ok(),
    putTransport: ok(),
    deleteTransport: ok(),
    putInsurance: ok(),
    deleteInsurance: ok(),
    putCustoms: ok(),
    deleteCustoms: ok(),
    createNote: ok(),
    uploadMemory: ok(),
    updateNote: ok(),
    deleteMemory: ok(),
    setReaction: ok(),
    resolveFileUrl: jest.fn(async (uri: string) => uri),
  };
  const prefs = {
    load: jest.fn(async (_userId: string) => ({ avatar: 'file:///avatar.jpg', biometricUnlock: true })),
    save: jest.fn(async (_userId: string, _prefs: unknown) => undefined),
  };
  const endSession = jest.fn(async () => undefined);

  const actions = createRemoteActions({
    data: data as unknown as RemoteData,
    dispatch: (action) => {
      state = reducer(state, action);
    },
    getState: () => state,
    notify: (message) => notices.push(message),
    endSession,
    prefs,
  });

  return { actions, data, prefs, endSession, notices, serverTrip, state: () => state, trip: () => state.trips[0]! };
}

describe('signing in', () => {
  it('loads the profile, with the device-only settings, and the trips', async () => {
    const { actions, state, data, prefs } = setup({ authenticated: false, trips: [], loadedTrips: {} });

    actions.signIn();
    expect(state()).toMatchObject({ authenticated: true, tripsStatus: 'loading' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(data.trips).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({
      tripsStatus: 'ready',
      profile: { id: 'u1', username: '@sofiam', biometricUnlock: true, avatar: 'file:///avatar.jpg' },
    });
    expect(state().trips).toHaveLength(1);
    expect(prefs.load).toHaveBeenCalledWith('u1');
  });

  it('tells the user when the trips cannot be loaded', async () => {
    const { actions, state, data, notices } = setup({ authenticated: false });
    data.trips.mockRejectedValueOnce(new TypeError('Network request failed'));

    actions.signIn();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state().tripsStatus).toBe('error');
    expect(notices).toEqual(['Nessuna connessione: la modifica non è stata salvata.']);
  });

  it('retries the whole first load from the hub when it had failed', async () => {
    const { actions, state, data } = setup({ tripsStatus: 'error', trips: [] });

    await actions.refreshTrips();

    expect(data.profile).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ tripsStatus: 'ready', profile: { username: '@sofiam' } });
  });

  it('drops what arrives for a session that has ended', async () => {
    const { actions, state, data, notices } = setup({ authenticated: false });
    let releaseTrips!: (trips: Trip[]) => void;
    data.trips.mockImplementationOnce(() => new Promise<Trip[]>((resolve) => (releaseTrips = resolve)));
    let failSave!: (error: Error) => void;
    data.putStay.mockImplementationOnce(() => new Promise((_resolve, reject) => (failSave = reject)));

    actions.signIn();
    const save = actions.setStay(TRIP_ID, 'G1', { name: 'X', address: 'Y', doc: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
    actions.signOut();
    releaseTrips([tripFixture()]);
    failSave(new TypeError('Network request failed'));
    await save;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(state()).toEqual(remoteInitialState);
    expect(notices).toEqual([]);
  });

  it('signs out once, with one notice, however many requests the server refuses', () => {
    const { actions, state, endSession, notices } = setup({ authenticated: false });
    actions.signIn();

    actions.sessionExpired();
    actions.sessionExpired();

    expect(state()).toEqual(remoteInitialState);
    expect(endSession).toHaveBeenCalledTimes(1);
    expect(notices).toEqual(['Sessione scaduta: accedi di nuovo.']);
  });

  it('forgets everything on sign out', () => {
    const { actions, state, endSession } = setup();

    actions.signOut();

    expect(state()).toEqual(remoteInitialState);
    expect(endSession).toHaveBeenCalled();
  });
});

describe('error messages', () => {
  it('blames the connection only for network failures', () => {
    expect(describeError('Non salvato.', new TypeError('Network request failed'))).toMatch(/connessione/);
    expect(describeError('Non salvato.', new TypeError('Failed to fetch'))).toMatch(/connessione/);
    expect(describeError('Non salvato.', new TypeError("Cannot read properties of undefined (reading 'id')"))).toBe(
      'Non salvato.',
    );
    expect(describeError('Non salvato.', new ApiError(409, 'TRIP_FULL', 'Trip is full'))).toBe('Il viaggio è al completo.');
  });
});

describe('stay of the day', () => {
  it('shows the change at once, uploads the new voucher, then saves the stay with it', async () => {
    const { actions, data, trip } = setup();

    const done = actions.setStay(TRIP_ID, 'G1', { name: 'Hotel Nuovo', address: 'Vík', doc: pickedDoc });
    expect(trip().days[0]!.stay?.name).toBe('Hotel Nuovo');
    await done;

    expect(data.uploadDocument).toHaveBeenCalledWith(TRIP_ID, pickedDoc);
    expect(data.putStay).toHaveBeenCalledWith(TRIP_ID, 'G1', {
      name: 'Hotel Nuovo',
      address: 'Vík',
      documentId: 'uploaded-doc-id',
    });
    expect(data.trip).toHaveBeenCalledWith(TRIP_ID);
  });

  it('does not upload again a voucher that is already on the server', async () => {
    const { actions, data } = setup();

    await actions.setStay(TRIP_ID, 'G1', { name: 'Hotel Kría', address: 'Vík 2', doc: serverDoc });

    expect(data.uploadDocument).not.toHaveBeenCalled();
    expect(data.putStay).toHaveBeenCalledWith(TRIP_ID, 'G1', { name: 'Hotel Kría', address: 'Vík 2', documentId: undefined });
  });

  it('uploads a file picked on the phone, whatever id it carries', async () => {
    const { actions, data } = setup();
    const replaced = { ...serverDoc, uri: 'file:///cache/voucher-v2.pdf' };

    await actions.setStay(TRIP_ID, 'G1', { name: 'Hotel Kría', address: 'Vík', doc: replaced });

    expect(data.uploadDocument).toHaveBeenCalledWith(TRIP_ID, replaced);
  });

  it('detaches the voucher when it is removed, and deletes the stay when the stay is removed', async () => {
    const { actions, data } = setup();

    await actions.setStay(TRIP_ID, 'G1', { name: 'Hotel Kría', address: 'Vík', doc: null });
    expect(data.putStay).toHaveBeenLastCalledWith(TRIP_ID, 'G1', expect.objectContaining({ documentId: null }));

    await actions.setStay(TRIP_ID, 'G1', null);
    expect(data.deleteStay).toHaveBeenCalledWith(TRIP_ID, 'G1');
  });

  it('puts back what the server has, and says why, when the save is refused', async () => {
    const { actions, data, trip, notices } = setup();
    data.putStay.mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Coordinators only'));

    await actions.setStay(TRIP_ID, 'G1', { name: 'Hotel Abusivo', address: 'X', doc: null });

    expect(notices).toEqual(['Solo il coordinatore può farlo.']);
    expect(trip().days[0]!.stay?.name).toBe('Hotel Kría');
  });
});

describe('activities', () => {
  it('creates an activity added on the phone', async () => {
    const { actions, data } = setup();

    await actions.upsertActivity(TRIP_ID, 'G3', { id: 'act-local-1', name: 'Cena', place: 'Vík', doc: null });

    expect(data.createActivity).toHaveBeenCalledWith(TRIP_ID, 'G3', { name: 'Cena', place: 'Vík', documentId: undefined });
    expect(data.updateActivity).not.toHaveBeenCalled();
  });

  it('updates an activity that came from the server', async () => {
    const { actions, data } = setup();

    await actions.upsertActivity(TRIP_ID, 'G2', { id: ACTIVITY_ID, name: 'Ghiacciaio al tramonto', place: 'X', doc: null });

    expect(data.updateActivity).toHaveBeenCalledWith(TRIP_ID, ACTIVITY_ID, {
      name: 'Ghiacciaio al tramonto',
      place: 'X',
      documentId: undefined,
    });
  });

  it('only asks the server to delete what the server knows', async () => {
    const { actions, data } = setup();

    await actions.deleteActivity(TRIP_ID, 'G2', 'act-local-2');
    await actions.deleteActivity(TRIP_ID, 'G2', ACTIVITY_ID);

    expect(data.deleteActivity).toHaveBeenCalledTimes(1);
    expect(data.deleteActivity).toHaveBeenCalledWith(TRIP_ID, ACTIVITY_ID);
  });
});

describe('reactions', () => {
  it('sets a reaction, then removes it when tapped again, without reloading the trip', async () => {
    const { actions, data, trip } = setup();

    await actions.toggleReaction(TRIP_ID, MEMORY_ID, '❤️');
    expect(data.setReaction).toHaveBeenLastCalledWith(TRIP_ID, MEMORY_ID, '❤️');
    expect(trip().memories[0]).toMatchObject({ myReaction: '❤️', reactions: { '🔥': 1, '❤️': 1 } });

    await actions.toggleReaction(TRIP_ID, MEMORY_ID, '❤️');
    expect(data.setReaction).toHaveBeenLastCalledWith(TRIP_ID, MEMORY_ID, null);
    expect(data.trip).not.toHaveBeenCalled();
  });
});

describe('trip reloads', () => {
  it('ignores a reload that arrives after a newer one', async () => {
    const { actions, data, trip } = setup();
    let releaseSlow!: (trip: Trip) => void;
    data.trip
      .mockImplementationOnce(() => new Promise<Trip>((resolve) => (releaseSlow = resolve)))
      .mockImplementationOnce(async () => tripFixture({ title: 'Versione nuova' }));

    const slow = actions.loadTrip(TRIP_ID);
    await actions.loadTrip(TRIP_ID);
    releaseSlow(tripFixture({ title: 'Versione vecchia' }));
    await slow;

    expect(trip().title).toBe('Versione nuova');
  });
});

describe('profile', () => {
  it('keeps device-only settings on the phone', async () => {
    const { actions, data, prefs } = setup();

    await actions.patchProfile({ biometricUnlock: false });

    expect(prefs.save).toHaveBeenCalledWith('u1', expect.objectContaining({ biometricUnlock: false }));
    expect(data.updateProfile).not.toHaveBeenCalled();
  });

  it('sends the rest to the server and uploads a new passport scan', async () => {
    const { actions, data } = setup();

    await actions.patchProfile({
      medicalNotes: 'Allergia alle arachidi',
      passport: { number: 'YA9182773', expiry: '04/2029', photoUri: 'file:///scan.jpg' },
    });

    expect(data.updateProfile).toHaveBeenCalledWith({
      medicalNotes: 'Allergia alle arachidi',
      passport: { number: 'YA9182773', expiry: '04/2029' },
    });
    expect(data.uploadPassportPhoto).toHaveBeenCalledWith('file:///scan.jpg');
  });
});

describe('creating a trip', () => {
  it('adds the trip the server created and returns it', async () => {
    const { actions, state } = setup();

    const trip = await actions.createTrip({
      title: 'Giappone',
      startDate: '2026-11-01',
      endDate: '2026-11-12',
      coordinatorName: 'Sofia',
      coordinatorPhone: '',
      crewNames: [],
    });

    expect(trip.id).toBe('55555555-5555-4555-8555-555555555555');
    expect(state().trips[0]!.id).toBe(trip.id);
    expect(state().loadedTrips[trip.id]).toBe(true);
  });
});
