import { ApiError } from '@/api/client';
import { toProfilePatch, toUserProfile } from '@/api/mappers';
import type { LocalPrefsStore } from '@/data/localPrefs';
import type { RemoteData } from '@/data/remote';
import type { DocumentRef, Trip, UserProfile } from '@/types';

import { memoryFromDraft } from './drafts';
import { type Action, type AppActions, type AppState, remoteInitialState } from './state';

/**
 * Le azioni dello store quando i dati vivono sul backend.
 *
 * Ogni modifica segue lo stesso schema: (1) lo stato locale cambia subito, con
 * lo stesso riduttore del prototipo, così l'interfaccia resta istantanea;
 * (2) parte la chiamata al backend; (3) il viaggio si rilegge dal server, che
 * assegna gli id veri e normalizza i valori. Se la chiamata fallisce, la
 * rilettura annulla la modifica locale e l'utente riceve un messaggio.
 */
export interface RemoteActionsDeps {
  data: RemoteData;
  dispatch: (action: Action) => void;
  getState: () => AppState;
  /** Un messaggio per l'utente (toast). */
  notify: (message: string) => void;
  /** Chiude la sessione Supabase. */
  endSession: () => Promise<void>;
  prefs: LocalPrefsStore;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Gli id del server sono UUID; quelli creati sul telefono in attesa del server no. */
export const isServerId = (id: string) => UUID.test(id);

/**
 * Un file appena scelto sul telefono (rullino, file picker; su web un `blob:`),
 * quindi da caricare. Non lo sono i riferimenti `api:` né gli URL remoti.
 */
export const isFreshFile = (uri: string) => uri !== '' && !uri.startsWith('api:') && !/^https?:\/\//.test(uri);

/** I codici d'errore dell'API che hanno un messaggio dedicato. */
const ERROR_MESSAGES: Record<string, string> = {
  TRIP_FULL: 'Il viaggio è al completo.',
  DOCUMENT_UNAVAILABLE: 'Il documento non è più disponibile: caricalo di nuovo.',
  DAYS_HAVE_CONTENT: 'Ci sono ancora contenuti nei giorni che vuoi togliere.',
  LAST_COORDINATOR: 'Il viaggio ha bisogno di almeno un coordinatore.',
  USERNAME_TAKEN: 'Questo nome utente è già preso.',
  UNSUPPORTED_FILE_TYPE: 'Questo tipo di file non è supportato.',
  PAYLOAD_TOO_LARGE: 'Il file è troppo grande.',
  FORBIDDEN: 'Solo il coordinatore può farlo.',
};

export function describeError(fallback: string, error: unknown): string {
  if (error instanceof ApiError) return ERROR_MESSAGES[error.code] ?? fallback;
  // Senza rete fetch rifiuta con un TypeError ("Network request failed" su
  // React Native, "Failed to fetch" / "Load failed" nei browser). Gli altri
  // TypeError sono bug, non problemi di connessione.
  if (error instanceof TypeError && /network|fetch|load failed/i.test(error.message)) {
    return 'Nessuna connessione: la modifica non è stata salvata.';
  }
  return fallback;
}

const findTrip = (state: AppState, tripId: string): Trip | undefined => state.trips.find((trip) => trip.id === tripId);

export interface RemoteActions extends AppActions {
  /** Il backend ha rifiutato il token: si torna al login, una volta sola. */
  sessionExpired: () => void;
}

export function createRemoteActions({
  data,
  dispatch,
  getState,
  notify,
  endSession,
  prefs,
}: RemoteActionsDeps): RemoteActions {
  /**
   * Ogni accesso apre una sessione nuova. Le risposte che arrivano dopo un
   * logout (o dopo il login di un altro utente) sono della sessione vecchia:
   * si scartano, insieme ai loro messaggi d'errore.
   */
  let session = 0;
  let signedIn = false;
  const live = (started: number) => started === session;

  /**
   * Rilegge un viaggio dal server. Se nel frattempo è partita una rilettura più
   * recente dello stesso viaggio, questa arriva tardi e si scarta.
   */
  const versions = new Map<string, number>();
  async function refreshTrip(tripId: string) {
    const started = session;
    const version = (versions.get(tripId) ?? 0) + 1;
    versions.set(tripId, version);
    const trip = await data.trip(tripId);
    if (live(started) && versions.get(tripId) === version) dispatch({ type: 'putTrip', trip });
  }

  async function sync(tripId: string, failure: string, task: () => Promise<unknown>, { refresh = true } = {}) {
    const started = session;
    try {
      await task();
    } catch (error) {
      if (!live(started)) return;
      notify(describeError(failure, error));
      // La rilettura riporta la UI a ciò che il server ha davvero.
      await refreshTrip(tripId).catch(() => undefined);
      return;
    }
    if (refresh) await refreshTrip(tripId).catch(() => undefined);
  }

  /**
   * Il documento da mandare insieme a uno slot: `undefined` = invariato, `null`
   * = staccato, altrimenti l'id di un upload appena fatto.
   */
  async function documentInput(
    tripId: string,
    next: DocumentRef | null | undefined,
    previous: DocumentRef | null | undefined,
  ): Promise<string | null | undefined> {
    if (!next) return previous ? null : undefined;
    if (isServerId(next.id) && !isFreshFile(next.uri)) return previous?.id === next.id ? undefined : next.id;
    return data.uploadDocument(tripId, next);
  }

  const currentPrefs = (): Pick<UserProfile, 'avatar' | 'biometricUnlock'> => {
    const { avatar, biometricUnlock } = getState().profile;
    return { avatar, biometricUnlock };
  };

  async function reloadProfile() {
    const started = session;
    const profile = await data.profile();
    if (live(started)) dispatch({ type: 'setProfile', profile: toUserProfile(profile, currentPrefs()) });
  }

  /** Primo caricamento dopo l'accesso: profilo, viaggi e impostazioni del telefono. */
  async function hydrate() {
    const started = session;
    dispatch({ type: 'setTripsStatus', status: 'loading' });
    try {
      const [profile, trips] = await Promise.all([data.profile(), data.trips()]);
      const local = await prefs.load(profile.id);
      if (live(started)) dispatch({ type: 'hydrate', profile: toUserProfile(profile, local), trips });
    } catch (error) {
      if (!live(started)) return;
      dispatch({ type: 'setTripsStatus', status: 'error' });
      notify(describeError('Non è stato possibile caricare i tuoi viaggi.', error));
    }
  }

  const actions: RemoteActions = {
    signIn: () => {
      session += 1;
      signedIn = true;
      dispatch({ type: 'signIn' });
      void hydrate();
    },

    signOut: () => {
      session += 1;
      signedIn = false;
      dispatch({ type: 'reset', state: remoteInitialState });
      void endSession();
    },

    sessionExpired: () => {
      // Con più richieste in volo arrivano più 401: il logout e l'avviso sono uno.
      if (!signedIn) return;
      actions.signOut();
      notify('Sessione scaduta: accedi di nuovo.');
    },

    createTrip: async (draft) => {
      const started = session;
      const trip = await data.createTrip(draft);
      // Arrivato dopo un logout: il viaggio è dell'account uscito, non entra nello stato.
      if (live(started)) dispatch({ type: 'putTrip', trip });
      return trip;
    },

    loadTrip: async (tripId) => {
      const started = session;
      try {
        await refreshTrip(tripId);
      } catch (error) {
        if (live(started)) notify(describeError('Non è stato possibile aprire il viaggio.', error));
      }
    },

    refreshTrips: async () => {
      const { tripsStatus } = getState();
      if (tripsStatus === 'loading') return;
      // Se il primo caricamento non era riuscito si riprova tutto, profilo compreso.
      if (tripsStatus !== 'ready') return hydrate();
      const started = session;
      try {
        const trips = await data.trips();
        if (live(started)) dispatch({ type: 'mergeTrips', trips });
      } catch (error) {
        if (live(started)) notify(describeError('Non è stato possibile aggiornare i viaggi.', error));
      }
    },

    addMemory: (tripId, draft) => {
      const memory = memoryFromDraft(draft, getState().profile.id);
      dispatch({ type: 'addMemory', tripId, memory });
      return sync(tripId, 'Il ricordo non è stato pubblicato.', () =>
        memory.kind === 'note'
          ? data.createNote(tripId, { dayId: draft.dayId, visibility: draft.visibility, text: draft.text, mood: memory.mood })
          : data.uploadMemory(tripId, {
              dayId: draft.dayId,
              visibility: draft.visibility,
              caption: draft.text,
              uri: draft.uri ?? '',
            }),
      );
    },

    updateNote: (tripId, memoryId, text) => {
      dispatch({ type: 'updateNote', tripId, memoryId, text });
      if (!isServerId(memoryId)) return;
      return sync(tripId, 'La nota non è stata aggiornata.', () => data.updateNote(tripId, memoryId, text));
    },

    deleteMemory: (tripId, memoryId) => {
      dispatch({ type: 'deleteMemory', tripId, memoryId });
      if (!isServerId(memoryId)) return;
      return sync(tripId, 'Il ricordo non è stato eliminato.', () => data.deleteMemory(tripId, memoryId));
    },

    toggleReaction: (tripId, memoryId, reaction) => {
      const memory = findTrip(getState(), tripId)?.memories.find((item) => item.id === memoryId);
      const previous = memory && memory.kind !== 'note' ? memory.myReaction : null;
      dispatch({ type: 'toggleReaction', tripId, memoryId, reaction });
      if (!isServerId(memoryId)) return;
      // La reazione è già giusta a schermo: si rilegge solo se il server rifiuta.
      return sync(
        tripId,
        'La reazione non è stata salvata.',
        () => data.setReaction(tripId, memoryId, previous === reaction ? null : reaction),
        { refresh: false },
      );
    },

    setStay: (tripId, dayId, stay) => {
      const previous = findTrip(getState(), tripId)?.days.find((day) => day.id === dayId)?.stay ?? null;
      dispatch({ type: 'setStay', tripId, dayId, stay });
      return sync(tripId, "L'alloggio non è stato salvato.", async () => {
        if (!stay) {
          if (previous) await data.deleteStay(tripId, dayId);
          return;
        }
        const documentId = await documentInput(tripId, stay.doc, previous?.doc);
        await data.putStay(tripId, dayId, { name: stay.name, address: stay.address, documentId });
      });
    },

    upsertActivity: (tripId, dayId, activity) => {
      const previous = findTrip(getState(), tripId)
        ?.days.find((day) => day.id === dayId)
        ?.activities.find((item) => item.id === activity.id);
      dispatch({ type: 'upsertActivity', tripId, dayId, activity });
      return sync(tripId, "L'attività non è stata salvata.", async () => {
        const documentId = await documentInput(tripId, activity.doc, previous?.doc);
        const fields = { name: activity.name, place: activity.place, documentId };
        if (previous && isServerId(activity.id)) await data.updateActivity(tripId, activity.id, fields);
        else await data.createActivity(tripId, dayId, fields);
      });
    },

    deleteActivity: (tripId, dayId, activityId) => {
      dispatch({ type: 'deleteActivity', tripId, dayId, activityId });
      if (!isServerId(activityId)) return;
      return sync(tripId, "L'attività non è stata eliminata.", () => data.deleteActivity(tripId, activityId));
    },

    patchDocuments: (tripId, patch) => {
      const previous = findTrip(getState(), tripId)?.documents;
      dispatch({ type: 'patchDocuments', tripId, patch });
      return sync(tripId, 'Il documento non è stato salvato.', async () => {
        if (patch.customs !== undefined) {
          const { customs } = patch;
          if (!customs) {
            if (previous?.customs) await data.deleteCustoms(tripId);
          } else {
            const documentId = await documentInput(tripId, customs.doc, previous?.customs?.doc);
            await data.putCustoms(tripId, { code: customs.code, note: customs.note, documentId });
          }
        }
        // Il passaporto è uno per persona: si aggiorna nel profilo, e il viaggio lo rilegge.
        if (patch.passport !== undefined) {
          const { passport } = patch;
          await data.updateProfile({
            passport: passport?.number && passport.expiry ? { number: passport.number, expiry: passport.expiry } : null,
          });
          if (passport?.doc && isFreshFile(passport.doc.uri)) await data.uploadPassportPhoto(passport.doc.uri);
          await reloadProfile();
        }
      });
    },

    upsertTransport: (tripId, transport) => {
      const previous = findTrip(getState(), tripId)?.documents.transports.find((item) => item.id === transport.id);
      dispatch({ type: 'upsertTransport', tripId, transport });
      return sync(tripId, 'Il mezzo non è stato salvato.', async () => {
        const docs = await Promise.all(
          transport.docs.map(async (entry) => {
            const before = previous?.docs.find((doc) => doc.id === entry.id);
            return {
              id: before && isServerId(entry.id) ? entry.id : undefined,
              label: entry.label,
              documentId: await documentInput(tripId, entry.doc, before?.doc),
            };
          }),
        );
        const body = { name: transport.name, reference: transport.reference, mode: transport.mode, docs };
        if (previous && isServerId(transport.id)) await data.putTransport(tripId, transport.id, body);
        else await data.createTransport(tripId, body);
      });
    },

    deleteTransport: (tripId, transportId) => {
      dispatch({ type: 'deleteTransport', tripId, transportId });
      if (!isServerId(transportId)) return;
      return sync(tripId, 'Il mezzo non è stato eliminato.', () => data.deleteTransport(tripId, transportId));
    },

    setInsurance: (tripId, insurance) => {
      const previous = findTrip(getState(), tripId)?.documents.insurance ?? null;
      dispatch({ type: 'patchDocuments', tripId, patch: { insurance } });
      return sync(tripId, 'La polizza non è stata salvata.', async () => {
        if (!insurance) {
          if (previous) await data.deleteInsurance(tripId);
          return;
        }
        const documentId = await documentInput(tripId, insurance.doc, previous?.doc);
        await data.putInsurance(tripId, {
          company: insurance.company,
          policy: insurance.policy,
          coverage: insurance.coverage,
          emergencyPhone: insurance.emergencyPhone,
          documentId,
        });
      });
    },

    patchProfile: (patch) => {
      dispatch({ type: 'patchProfile', patch });
      // Ciò che resta sul telefono si salva lì, il resto va al backend.
      if (patch.avatar !== undefined || patch.biometricUnlock !== undefined) void prefs.save(getState().profile.id, currentPrefs());

      const body = toProfilePatch(patch);
      const photo = patch.passport?.photoUri;
      const uploadPhoto = !!photo && isFreshFile(photo);
      if (Object.keys(body).length === 0 && !uploadPhoto) return;

      const started = session;
      return (async () => {
        try {
          if (Object.keys(body).length > 0) await data.updateProfile(body);
          if (uploadPhoto) await data.uploadPassportPhoto(photo);
          await reloadProfile();
        } catch (error) {
          if (!live(started)) return;
          notify(describeError('Il profilo non è stato aggiornato.', error));
          await reloadProfile().catch(() => undefined);
        }
      })();
    },
  };
  return actions;
}
