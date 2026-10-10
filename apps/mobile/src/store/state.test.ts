import { describe, expect, it } from '@jest/globals';

import { MOCK_TRIPS } from '@/mock/trips';

import type { PhotoMemory, ReactionKey } from '@/types';

import { type AppState, mockInitialState, reducer, remoteInitialState } from './state';

describe('reducer', () => {
  it('keeps the programme of an open trip when the hub refreshes its cards', () => {
    const [opened, other] = MOCK_TRIPS;
    const state = { ...remoteInitialState, trips: [opened!, other!], loadedTrips: { [opened!.id]: true as const } };

    const next = reducer(state, {
      type: 'mergeTrips',
      trips: [
        { ...opened!, title: 'Titolo nuovo', days: [], memories: [] },
        { ...other!, days: [] },
      ],
    });

    expect(next.trips[0]).toMatchObject({ title: 'Titolo nuovo', days: opened!.days, memories: opened!.memories });
    expect(next.trips[1]!.days).toEqual([]);
  });

  it('drops the loaded flag of a trip that left the list', () => {
    const [gone] = MOCK_TRIPS;
    const state = { ...remoteInitialState, trips: [gone!], loadedTrips: { [gone!.id]: true as const } };

    expect(reducer(state, { type: 'mergeTrips', trips: [] }).loadedTrips).toEqual({});
  });

  it('replaces a trip with the server version, or adds it on top', () => {
    const [first, second] = MOCK_TRIPS;
    const state = { ...remoteInitialState, trips: [first!] };

    const replaced = reducer(state, { type: 'putTrip', trip: { ...first!, title: 'Dal server' } });
    const added = reducer(replaced, { type: 'putTrip', trip: second! });

    expect(added.trips.map((trip) => trip.title)).toEqual([second!.title, 'Dal server']);
    expect(added.loadedTrips).toEqual({ [first!.id]: true, [second!.id]: true });
  });

  it('counts one reaction per person: a new one replaces the previous', () => {
    const trip = MOCK_TRIPS.find((item) => item.memories.some((memory) => memory.kind !== 'note'))!;
    const photo = trip.memories.find((memory): memory is PhotoMemory => memory.kind !== 'note')!;
    const fresh: PhotoMemory = { ...photo, reactions: { '🔥': 2 }, myReaction: null };
    const state: AppState = { ...mockInitialState, trips: [{ ...trip, memories: [fresh] }] };
    const toggle = (s: AppState, reaction: ReactionKey) =>
      reducer(s, { type: 'toggleReaction', tripId: trip.id, memoryId: photo.id, reaction });
    const memory = (s: AppState) => s.trips[0]!.memories[0] as PhotoMemory;

    const once = toggle(state, '🔥');
    const changed = toggle(once, '🤯');
    const removed = toggle(changed, '🤯');

    expect(memory(once)).toMatchObject({ myReaction: '🔥', reactions: { '🔥': 3 } });
    expect(memory(changed)).toMatchObject({ myReaction: '🤯', reactions: { '🔥': 2, '🤯': 1 } });
    expect(memory(removed).myReaction).toBeNull();
    expect(memory(removed).reactions['🔥']).toBe(2);
    expect(memory(removed).reactions['🤯'] ?? 0).toBe(0);
  });
});
