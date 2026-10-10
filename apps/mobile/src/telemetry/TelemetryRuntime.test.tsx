import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { TelemetryRuntime } from './TelemetryRuntime';

/* Il motore senza store né rete: l'accesso lo decide il test, gli eventi finiscono in una lista. */
const mockState = { authenticated: true };
const mockEvents: string[] = [];

jest.mock('@/store/AppStore', () => ({ useAppState: () => mockState }));
jest.mock('./frames', () => ({ startFrameSampler: () => () => undefined }));
jest.mock('./index', () => ({
  currentScreen: { name: 'MyTrips' },
  telemetry: {
    enabled: true,
    event: (name: string) => mockEvents.push(name),
    forgetPerson: () => mockEvents.push('forget'),
    flush: async () => undefined,
    sample: () => undefined,
  },
}));

let changeListener: ((state: AppStateStatus) => void) | null = null;

beforeEach(() => {
  mockEvents.length = 0;
  mockState.authenticated = true;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    changeListener = listener as (state: AppStateStatus) => void;
    return { remove: () => (changeListener = null) } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TelemetryRuntime', () => {
  it('counts a return from the background as an app open, not a glance at the notification centre', async () => {
    await render(<TelemetryRuntime />);
    expect(mockEvents).toEqual(['app_open']);

    // Centro notifiche: active → inactive → active.
    changeListener?.('inactive');
    changeListener?.('active');
    expect(mockEvents).toEqual(['app_open']);

    // In background e ritorno: una nuova apertura.
    changeListener?.('inactive');
    changeListener?.('background');
    changeListener?.('active');
    expect(mockEvents).toEqual(['app_open', 'app_open']);
  });

  it("forgets the person's events on sign out", async () => {
    const { rerender } = await render(<TelemetryRuntime />);

    mockState.authenticated = false;
    await rerender(<TelemetryRuntime />);

    expect(mockEvents).toEqual(['app_open', 'forget']);
  });
});
