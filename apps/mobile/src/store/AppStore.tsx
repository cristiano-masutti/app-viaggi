import React, { createContext, useCallback, useContext, useMemo, useReducer } from 'react';

import { buildEmptyDays, daysBetween } from '@/lib/date';
import { createId } from '@/lib/id';
import { MOCK_PROFILE } from '@/mock/profile';
import { ME, MOCK_TRIPS } from '@/mock/trips';
import { blurhash } from '@/theme/palette';
import type {
  Activity,
  CrewMember,
  DayId,
  InsuranceInfo,
  Memory,
  NewMemoryDraft,
  NewTripDraft,
  ReactionKey,
  Stay,
  Transport,
  Trip,
  TripDocuments,
  UserProfile,
} from '@/types';

/**
 * Stato unico dell'app.
 *
 * Tutto il prototipo legge e scrive da qui: cambiare tab, filtrare, creare un
 * viaggio o modificare un alloggio sono riduzioni pure su questo stato. Nessuna
 * schermata tiene una copia dei dati, quindi non esistono due verità diverse
 * sullo stesso viaggio.
 */
interface AppState {
  authenticated: boolean;
  profile: UserProfile;
  trips: Trip[];
}

type Action =
  | { type: 'signIn' }
  | { type: 'signOut' }
  | { type: 'createTrip'; trip: Trip }
  | { type: 'addMemory'; tripId: string; memory: Memory }
  | { type: 'updateNote'; tripId: string; memoryId: string; text: string }
  | { type: 'deleteMemory'; tripId: string; memoryId: string }
  | { type: 'toggleReaction'; tripId: string; memoryId: string; reaction: ReactionKey }
  | { type: 'setStay'; tripId: string; dayId: DayId; stay: Stay | null }
  | { type: 'upsertActivity'; tripId: string; dayId: DayId; activity: Activity }
  | { type: 'deleteActivity'; tripId: string; dayId: DayId; activityId: string }
  | { type: 'patchDocuments'; tripId: string; patch: Partial<TripDocuments> }
  | { type: 'upsertTransport'; tripId: string; transport: Transport }
  | { type: 'deleteTransport'; tripId: string; transportId: string }
  | { type: 'patchProfile'; patch: Partial<UserProfile> };

const initialState: AppState = {
  authenticated: false,
  profile: MOCK_PROFILE,
  trips: MOCK_TRIPS,
};

/** Applica una trasformazione a un solo viaggio, lasciando gli altri intatti. */
const mapTrip = (trips: Trip[], tripId: string, update: (trip: Trip) => Trip) =>
  trips.map((trip) => (trip.id === tripId ? update(trip) : trip));

const mapDay = (
  trip: Trip,
  dayId: DayId,
  update: (day: Trip['days'][number]) => Trip['days'][number],
): Trip => ({
  ...trip,
  days: trip.days.map((day) => (day.id === dayId ? update(day) : day)),
});

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'signIn':
      return { ...state, authenticated: true };

    case 'signOut':
      return { ...state, authenticated: false };

    case 'createTrip':
      // I viaggi futuri più vicini restano in cima: il nuovo entra come primo.
      return { ...state, trips: [action.trip, ...state.trips] };

    case 'addMemory':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) => ({
          ...trip,
          memories: [action.memory, ...trip.memories],
        })),
      };

    case 'updateNote':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) => ({
          ...trip,
          memories: trip.memories.map((memory) =>
            memory.id === action.memoryId && memory.kind === 'note'
              ? { ...memory, text: action.text }
              : memory,
          ),
        })),
      };

    case 'deleteMemory':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) => ({
          ...trip,
          memories: trip.memories.filter((memory) => memory.id !== action.memoryId),
        })),
      };

    case 'toggleReaction':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) => ({
          ...trip,
          memories: trip.memories.map((memory) => {
            if (memory.id !== action.memoryId || memory.kind === 'note') return memory;

            const reactions = { ...memory.reactions };
            const previous = memory.myReaction;

            // Una reazione per persona: la precedente viene scalata.
            if (previous) reactions[previous] = Math.max(0, (reactions[previous] ?? 1) - 1);

            const removing = previous === action.reaction;
            if (!removing) reactions[action.reaction] = (reactions[action.reaction] ?? 0) + 1;

            return { ...memory, reactions, myReaction: removing ? null : action.reaction };
          }),
        })),
      };

    case 'setStay':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) =>
          mapDay(trip, action.dayId, (day) => ({ ...day, stay: action.stay })),
        ),
      };

    case 'upsertActivity':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) =>
          mapDay(trip, action.dayId, (day) => {
            const exists = day.activities.some((activity) => activity.id === action.activity.id);
            return {
              ...day,
              activities: exists
                ? day.activities.map((activity) =>
                    activity.id === action.activity.id ? action.activity : activity,
                  )
                : [...day.activities, action.activity],
            };
          }),
        ),
      };

    case 'deleteActivity':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) =>
          mapDay(trip, action.dayId, (day) => ({
            ...day,
            activities: day.activities.filter((activity) => activity.id !== action.activityId),
          })),
        ),
      };

    case 'patchDocuments':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) => ({
          ...trip,
          documents: { ...trip.documents, ...action.patch },
        })),
      };

    case 'upsertTransport':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) => {
          const exists = trip.documents.transports.some((item) => item.id === action.transport.id);
          return {
            ...trip,
            documents: {
              ...trip.documents,
              transports: exists
                ? trip.documents.transports.map((item) =>
                    item.id === action.transport.id ? action.transport : item,
                  )
                : [...trip.documents.transports, action.transport],
            },
          };
        }),
      };

    case 'deleteTransport':
      return {
        ...state,
        trips: mapTrip(state.trips, action.tripId, (trip) => ({
          ...trip,
          documents: {
            ...trip.documents,
            transports: trip.documents.transports.filter((item) => item.id !== action.transportId),
          },
        })),
      };

    case 'patchProfile':
      return { ...state, profile: { ...state.profile, ...action.patch } };

    default:
      return state;
  }
}

/* ── Contesti separati ───────────────────────────────────────────────── */

/**
 * Stato e azioni viaggiano su due contesti distinti: le azioni hanno identità
 * stabile, quindi un componente che usa solo `useAppActions()` non si ri-renderizza
 * quando cambia un viaggio. È la differenza tra una lista che scorre liscia e una
 * che sbatte a ogni tap.
 */
const AppStateContext = createContext<AppState | null>(null);
const AppActionsContext = createContext<AppActions | null>(null);

interface AppActions {
  signIn: () => void;
  signOut: () => void;
  /** Costruisce il viaggio dalla bozza del form e lo inserisce fra i futuri. */
  createTrip: (draft: NewTripDraft) => Trip;
  addMemory: (tripId: string, draft: NewMemoryDraft) => void;
  /** Correzione del testo di una nota di diario già pubblicata. */
  updateNote: (tripId: string, memoryId: string, text: string) => void;
  deleteMemory: (tripId: string, memoryId: string) => void;
  toggleReaction: (tripId: string, memoryId: string, reaction: ReactionKey) => void;
  setStay: (tripId: string, dayId: DayId, stay: Stay | null) => void;
  upsertActivity: (tripId: string, dayId: DayId, activity: Activity) => void;
  deleteActivity: (tripId: string, dayId: DayId, activityId: string) => void;
  patchDocuments: (tripId: string, patch: Partial<TripDocuments>) => void;
  upsertTransport: (tripId: string, transport: Transport) => void;
  deleteTransport: (tripId: string, transportId: string) => void;
  setInsurance: (tripId: string, insurance: InsuranceInfo | null) => void;
  patchProfile: (patch: Partial<UserProfile>) => void;
}

/** Ora corrente in formato '18:42', come la scrive un ricordo appena salvato. */
const nowLabel = () =>
  new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', hour12: false });

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const createTrip = useCallback((draft: NewTripDraft): Trip => {
    const totalDays = daysBetween(draft.startDate, draft.endDate);

    const coordinator: CrewMember = {
      id: createId('crew'),
      name: draft.coordinatorName,
      handle: draft.coordinatorPhone || '—',
      role: 'coordinator',
      confirmed: true,
    };

    const crew: CrewMember[] = [
      ME,
      coordinator,
      // I compagni inseriti nel form partono come invitati non ancora confermati.
      ...draft.crewNames.map((name) => ({
        id: createId('crew'),
        name,
        handle: '—',
        role: 'traveller' as const,
        confirmed: false,
      })),
    ];

    const trip: Trip = {
      id: createId('trip'),
      status: 'upcoming',
      title: draft.title,
      cover: draft.cover,
      coverBlurhash: blurhash.ink,
      startDate: draft.startDate,
      endDate: draft.endDate,
      totalDays,
      coordinator,
      crew,
      crewCapacity: Math.max(crew.length, 10),
      inviteCode: `${draft.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 18)}-${Math.random().toString(36).slice(2, 6)}`,
      // Giorni vuoti: la tab Organizza li mostrerà come placeholder da riempire.
      days: buildEmptyDays(draft.startDate, totalDays),
      documents: { passport: null, customs: null, transports: [], insurance: null },
      emergencies: [
        {
          id: createId('sos'),
          title: `📣 ${coordinator.name} • Coordinatore`,
          subtitle: 'Primo contatto del gruppo, sempre raggiungibile',
          actionLabel: 'Chiama il coordinatore',
          phone: draft.coordinatorPhone || '112',
          whatsapp: true,
        },
        {
          id: createId('sos'),
          title: '🚨 112 • Numero Unico Emergenze',
          subtitle: 'Polizia, ambulanza, vigili del fuoco e soccorso stradale',
          actionLabel: 'Chiama 112',
          phone: '112',
        },
      ],
      memories: [],
    };

    dispatch({ type: 'createTrip', trip });
    return trip;
  }, []);

  const addMemory = useCallback((tripId: string, draft: NewMemoryDraft) => {
    const base = {
      id: createId('mem'),
      dayId: draft.dayId,
      authorId: ME.id,
      time: nowLabel(),
      visibility: draft.visibility,
    };

    const memory: Memory =
      draft.format === 'note'
        ? {
            ...base,
            kind: 'note',
            text: draft.text,
            // Una nota privata è sempre etichettata 🔒, qualunque tag fosse selezionato.
            mood: draft.visibility === 'private' ? '🔒 Personale' : draft.mood,
          }
        : {
            ...base,
            kind: 'photo',
            uri: draft.uri ?? '',
            blurhash: blurhash.ink,
            caption: draft.text || undefined,
            aspectRatio: 1,
            reactions: {},
            myReaction: null,
          };

    dispatch({ type: 'addMemory', tripId, memory });
  }, []);

  const actions = useMemo<AppActions>(
    () => ({
      signIn: () => dispatch({ type: 'signIn' }),
      signOut: () => dispatch({ type: 'signOut' }),
      createTrip,
      addMemory,
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
    [addMemory, createTrip],
  );

  return (
    <AppStateContext.Provider value={state}>
      <AppActionsContext.Provider value={actions}>{children}</AppActionsContext.Provider>
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
