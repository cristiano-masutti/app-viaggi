import type {
  Activity,
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
import { MOCK_PROFILE } from '@/mock/profile';
import { MOCK_TRIPS } from '@/mock/trips';

/**
 * Stato unico dell'app.
 *
 * Tutto il prototipo legge e scrive da qui: cambiare tab, filtrare, creare un
 * viaggio o modificare un alloggio sono riduzioni pure su questo stato. Nessuna
 * schermata tiene una copia dei dati, quindi non esistono due verità diverse
 * sullo stesso viaggio.
 */
export interface AppState {
  authenticated: boolean;
  profile: UserProfile;
  trips: Trip[];
  /** L'elenco dei viaggi: in modalità reale arriva dal backend dopo il login. */
  tripsStatus: 'idle' | 'loading' | 'ready' | 'error';
  /**
   * Viaggi di cui c'è il dettaglio (giorni, documenti, ricordi). L'hub riceve
   * solo i riepiloghi: il resto si carica entrando nel viaggio.
   */
  loadedTrips: Record<string, true>;
}

export type Action =
  | { type: 'signIn' }
  | { type: 'signOut' }
  | { type: 'createTrip'; trip: Trip }
  /** Profilo ed elenco viaggi appena arrivati dal backend. */
  | { type: 'hydrate'; profile: UserProfile; trips: Trip[] }
  | { type: 'setTripsStatus'; status: AppState['tripsStatus'] }
  /** Riepiloghi aggiornati: i viaggi già caricati tengono il loro dettaglio. */
  | { type: 'mergeTrips'; trips: Trip[] }
  /** Un viaggio completo dal backend: sostituisce la versione locale. */
  | { type: 'putTrip'; trip: Trip }
  | { type: 'setProfile'; profile: UserProfile }
  /** All'uscita: niente dati del vecchio utente in memoria. */
  | { type: 'reset'; state: AppState }
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

/** Il prototipo: dati completi in memoria, tutti già "caricati". */
export const mockInitialState: AppState = {
  authenticated: false,
  profile: MOCK_PROFILE,
  trips: MOCK_TRIPS,
  tripsStatus: 'ready',
  loadedTrips: Object.fromEntries(MOCK_TRIPS.map((trip) => [trip.id, true as const])),
};

/** Profilo vuoto finché il backend non risponde: le schermate non devono mai vedere `undefined`. */
export const EMPTY_PROFILE: UserProfile = {
  id: '',
  firstName: '',
  lastName: '',
  username: '',
  avatar: '',
  bio: '',
  passport: { number: '', expiry: '', photoUri: '' },
  fiscalCode: '',
  diet: '',
  medicalNotes: '',
  biometricUnlock: false,
};

export const remoteInitialState: AppState = {
  authenticated: false,
  profile: EMPTY_PROFILE,
  trips: [],
  tripsStatus: 'idle',
  loadedTrips: {},
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

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'signIn':
      return { ...state, authenticated: true };

    case 'signOut':
      return { ...state, authenticated: false };

    case 'createTrip':
      // I viaggi futuri più vicini restano in cima: il nuovo entra come primo.
      return {
        ...state,
        trips: [action.trip, ...state.trips],
        loadedTrips: { ...state.loadedTrips, [action.trip.id]: true },
      };

    case 'hydrate':
      return {
        ...state,
        profile: action.profile,
        trips: action.trips,
        tripsStatus: 'ready',
        loadedTrips: {},
      };

    case 'setTripsStatus':
      return { ...state, tripsStatus: action.status };

    case 'mergeTrips': {
      const current = new Map(state.trips.map((trip) => [trip.id, trip]));
      return {
        ...state,
        tripsStatus: 'ready',
        trips: action.trips.map((summary) => {
          const loaded = state.loadedTrips[summary.id] ? current.get(summary.id) : undefined;
          // Del viaggio aperto si aggiornano i dati della card, non il programma già caricato.
          return loaded
            ? {
                ...summary,
                days: loaded.days,
                documents: loaded.documents,
                emergencies: loaded.emergencies,
                memories: loaded.memories,
                crew: loaded.crew,
              }
            : summary;
        }),
        // Un viaggio che non è più nell'elenco (uscito, cancellato) non resta "caricato".
        loadedTrips: Object.fromEntries(
          Object.keys(state.loadedTrips)
            .filter((id) => action.trips.some((trip) => trip.id === id))
            .map((id) => [id, true as const]),
        ),
      };
    }

    case 'putTrip': {
      const exists = state.trips.some((trip) => trip.id === action.trip.id);
      return {
        ...state,
        trips: exists
          ? state.trips.map((trip) => (trip.id === action.trip.id ? action.trip : trip))
          : [action.trip, ...state.trips],
        loadedTrips: { ...state.loadedTrips, [action.trip.id]: true },
      };
    }

    case 'setProfile':
      return { ...state, profile: action.profile };

    case 'reset':
      return action.state;

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

/**
 * Le azioni che le schermate possono chiedere. Le due modalità (prototipo e
 * backend reale) le implementano entrambe con la stessa firma: le schermate non
 * sanno quale stanno usando.
 */
export interface AppActions {
  signIn: () => void;
  signOut: () => void;
  /** Costruisce il viaggio dalla bozza del form e lo inserisce fra i futuri. */
  createTrip: (draft: NewTripDraft) => Promise<Trip>;
  /** Carica (o ricarica) il dettaglio di un viaggio: giorni, documenti, ricordi. */
  loadTrip: (tripId: string) => Promise<void>;
  /** Riallinea l'elenco dei viaggi (hub). */
  refreshTrips: () => Promise<void>;
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
