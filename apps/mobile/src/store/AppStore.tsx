import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

import { type ApiClientOptions, createApiClient } from '@/api/client';
import { useAuth } from '@/auth/AuthProvider';
import { backendConfig } from '@/config';
import { secureLocalPrefs } from '@/data/localPrefs';
import { createRemoteData } from '@/data/remote';
import { ME } from '@/mock/trips';
import type { Trip } from '@/types';

import { memoryFromDraft, tripFromDraft } from './drafts';
import { createRemoteActions, type RemoteActions } from './remoteActions';
import { type AppActions, type AppState, mockInitialState, reducer, remoteInitialState } from './state';

export type { AppActions, AppState };

/*
 * Stato unico dell'app.
 *
 * Tutte le schermate leggono e scrivono da qui; il riduttore (`state.ts`) è lo
 * stesso in entrambe le modalità. Cambia solo chi produce le azioni:
 * - prototipo: riduzioni pure su dati in memoria;
 * - backend reale (`remoteActions.ts`): la stessa riduzione subito, poi la
 *   chiamata all'API e il riallineamento con il server.
 */

/* ── Contesti separati ───────────────────────────────────────────────── */

/**
 * Stato e azioni viaggiano su due contesti distinti: le azioni hanno identità
 * stabile, quindi un componente che usa solo `useAppActions()` non si ri-renderizza
 * quando cambia un viaggio. È la differenza tra una lista che scorre liscia e una
 * che sbatte a ogni tap.
 */
const AppStateContext = createContext<AppState | null>(null);
const AppActionsContext = createContext<AppActions | null>(null);

/** Da riferimento di un file (`api:…`) a URL scaricabile; nel prototipo l'URI è già quello. */
type FileUrlResolver = (uri: string) => Promise<string>;
const FileUrlContext = createContext<FileUrlResolver>(async (uri) => uri);

/** Messaggi per l'utente prodotti dallo store (errori di sincronizzazione). */
type NoticeListener = (message: string) => void;
const NoticesContext = createContext<Set<NoticeListener> | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const remote = auth.mode === 'remote' && backendConfig !== null;
  const [state, dispatch] = useReducer(reducer, remote ? remoteInitialState : mockInitialState);

  // Le azioni remote leggono lo stato corrente senza cambiare identità a ogni render.
  const stateRef = useRef(state);
  stateRef.current = state;

  const listeners = useMemo(() => new Set<NoticeListener>(), []);
  const notify = useCallback((message: string) => listeners.forEach((listener) => listener(message)), [listeners]);

  const remoteSetup = useMemo(() => {
    if (!remote || !backendConfig) return null;

    const options: ApiClientOptions = {
      baseUrl: backendConfig.apiUrl,
      getAccessToken: auth.getAccessToken,
      // Token scaduto o revocato: si torna al login.
      onUnauthorized: () => actions.sessionExpired(),
    };
    const data = createRemoteData(createApiClient(options), options);
    const actions: RemoteActions = createRemoteActions({
      data,
      dispatch,
      getState: () => stateRef.current,
      notify,
      endSession: auth.signOut,
      prefs: secureLocalPrefs,
    });
    return { actions, resolveFileUrl: data.resolveFileUrl };
  }, [auth, notify, remote]);

  const mockActions = useMemo<AppActions>(
    () => ({
      signIn: () => dispatch({ type: 'signIn' }),
      signOut: () => dispatch({ type: 'signOut' }),
      createTrip: async (draft) => {
        const trip = tripFromDraft(draft, ME);
        dispatch({ type: 'createTrip', trip });
        return trip;
      },
      loadTrip: async () => undefined,
      refreshTrips: async () => undefined,
      addMemory: (tripId, draft) =>
        dispatch({ type: 'addMemory', tripId, memory: memoryFromDraft(draft, stateRef.current.profile.id) }),
      updateNote: (tripId, memoryId, text) => dispatch({ type: 'updateNote', tripId, memoryId, text }),
      deleteMemory: (tripId, memoryId) => dispatch({ type: 'deleteMemory', tripId, memoryId }),
      toggleReaction: (tripId, memoryId, reaction) =>
        dispatch({ type: 'toggleReaction', tripId, memoryId, reaction }),
      setStay: (tripId, dayId, stay) => dispatch({ type: 'setStay', tripId, dayId, stay }),
      upsertActivity: (tripId, dayId, activity) =>
        dispatch({ type: 'upsertActivity', tripId, dayId, activity }),
      deleteActivity: (tripId, dayId, activityId) =>
        dispatch({ type: 'deleteActivity', tripId, dayId, activityId }),
      patchDocuments: (tripId, patch) => dispatch({ type: 'patchDocuments', tripId, patch }),
      upsertTransport: (tripId, transport) => dispatch({ type: 'upsertTransport', tripId, transport }),
      deleteTransport: (tripId, transportId) => dispatch({ type: 'deleteTransport', tripId, transportId }),
      setInsurance: (tripId, insurance) => dispatch({ type: 'patchDocuments', tripId, patch: { insurance } }),
      patchProfile: (patch) => dispatch({ type: 'patchProfile', patch }),
    }),
    [],
  );

  const actions = remoteSetup?.actions ?? mockActions;
  const resolveFileUrl = remoteSetup?.resolveFileUrl ?? (async (uri: string) => uri);

  return (
    <AppStateContext.Provider value={state}>
      <AppActionsContext.Provider value={actions}>
        <FileUrlContext.Provider value={resolveFileUrl}>
          <NoticesContext.Provider value={listeners}>{children}</NoticesContext.Provider>
        </FileUrlContext.Provider>
      </AppActionsContext.Provider>
    </AppStateContext.Provider>
  );
}

/* ── Hook di lettura ─────────────────────────────────────────────────── */

export function useAppState(): AppState {
  const state = useContext(AppStateContext);
  if (!state) throw new Error('useAppState va usato dentro <AppProvider />');
  return state;
}

export function useAppActions(): AppActions {
  const actions = useContext(AppActionsContext);
  if (!actions) throw new Error('useAppActions va usato dentro <AppProvider />');
  return actions;
}

export const useProfile = () => useAppState().profile;

/** Viaggi di un segmento, già ordinati come li vuole quel segmento. */
export function useTripsByStatus(status: Trip['status']): Trip[] {
  const { trips } = useAppState();
  return useMemo(() => {
    const subset = trips.filter((trip) => trip.status === status);
    // I futuri per partenza più vicina, i passati dal più recente.
    return subset.sort((a, b) =>
      status === 'past' ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate),
    );
  }, [status, trips]);
}

export function useTrip(tripId: string | undefined): Trip | undefined {
  const { trips } = useAppState();
  return useMemo(() => trips.find((trip) => trip.id === tripId), [tripId, trips]);
}

/** C'è il dettaglio completo del viaggio (giorni, documenti, ricordi)? */
export function useTripLoaded(tripId: string | undefined): boolean {
  const { loadedTrips } = useAppState();
  return !!tripId && !!loadedTrips[tripId];
}

/** Per chi scarica o mostra un file: da riferimento `api:` a URL firmato. */
export const useFileUrlResolver = () => useContext(FileUrlContext);

/** Riceve i messaggi dello store (es. "modifica non salvata") finché il componente è montato. */
export function useAppNotices(listener: NoticeListener) {
  const listeners = useContext(NoticesContext);
  const latest = useRef(listener);
  latest.current = listener;

  useEffect(() => {
    if (!listeners) return;
    const forward: NoticeListener = (message) => latest.current(message);
    listeners.add(forward);
    return () => {
      listeners.delete(forward);
    };
  }, [listeners]);
}
