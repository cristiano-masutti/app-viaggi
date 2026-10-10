import { Platform } from 'react-native';

import { apiRequest, type ApiClient, type ApiClientOptions, unwrap } from '@/api/client';
import {
  dayIndexOf,
  signedUrlPathFor,
  toApiMood,
  toApiReaction,
  toCreateTripBody,
  toMemory,
  tripFromDetail,
  tripFromSummary,
} from '@/api/mappers';
import type { paths } from '@/api/schema';
import type { DocumentDto, ProfileDto, UpdateProfileBody } from '@/api/types';
import type { DayId, DocumentRef, MemoryVisibility, NewTripDraft, NoteMood, ReactionKey, Trip } from '@/types';

/**
 * Tutto ciò che lo store chiede al backend, già nei tipi del mobile. Ogni
 * metodo è una chiamata (o due): niente stato, niente cache. Chi decide quando
 * chiamare e come aggiornare la UI è `remoteActions`.
 */
export type RemoteData = ReturnType<typeof createRemoteData>;

type Body<P extends keyof paths, M extends 'post' | 'put' | 'patch'> = paths[P][M] extends {
  requestBody?: { content: { 'application/json': infer B } };
}
  ? B
  : never;

export type StayBody = Body<'/api/trips/{tripId}/days/{day}/stay', 'put'>;
export type ActivityBody = Body<'/api/trips/{tripId}/days/{day}/activities', 'post'>;
export type ActivityPatch = Body<'/api/trips/{tripId}/activities/{activityId}', 'patch'>;
export type TransportBody = Body<'/api/trips/{tripId}/transports', 'post'>;
export type InsuranceBody = Body<'/api/trips/{tripId}/insurance', 'put'>;
export type CustomsBody = Body<'/api/trips/{tripId}/customs', 'put'>;

/** Una parte "file" di un FormData: su device un riferimento all'URI, su web il contenuto. */
async function filePart(uri: string, name: string, type: string): Promise<Blob> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  // React Native legge il file da sé a partire dall'URI.
  return { uri, name, type } as unknown as Blob;
}

const fileName = (doc: DocumentRef) => doc.subtitle || `${doc.title || 'documento'}.${doc.kind === 'pdf' ? 'pdf' : 'jpg'}`;
const fileType = (doc: DocumentRef) => (doc.kind === 'pdf' ? 'application/pdf' : 'image/jpeg');

export function createRemoteData(api: ApiClient, options: ApiClientOptions) {
  const tripPath = (tripId: string) => ({ params: { path: { tripId } } });

  return {
    profile: async (): Promise<ProfileDto> => (await unwrap(api.GET('/api/me'))).user,

    updateProfile: async (body: UpdateProfileBody): Promise<ProfileDto> =>
      (await unwrap(api.PATCH('/api/me', { body }))).user,

    uploadPassportPhoto: async (uri: string) => {
      const form = new FormData();
      form.append('file', await filePart(uri, 'passaporto.jpg', 'image/jpeg'), 'passaporto.jpg');
      await apiRequest(options, 'PUT', '/api/me/passport/photo', form);
    },

    trips: async (): Promise<Trip[]> =>
      (await unwrap(api.GET('/api/trips'))).trips.map((summary) => tripFromSummary(summary)),

    /** Il viaggio completo con la prima pagina di ricordi. */
    trip: async (tripId: string): Promise<Trip> => {
      const [{ trip }, { memories }] = await Promise.all([
        unwrap(api.GET('/api/trips/{tripId}', tripPath(tripId))),
        unwrap(
          api.GET('/api/trips/{tripId}/memories', {
            params: { path: { tripId }, query: { limit: 100 } },
          }),
        ),
      ]);
      return { ...tripFromDetail(trip), memories: memories.map((memory) => toMemory(tripId, memory)) };
    },

    createTrip: async (draft: NewTripDraft): Promise<Trip> =>
      tripFromDetail((await unwrap(api.POST('/api/trips', { body: toCreateTripBody(draft) }))).trip),

    /** Carica il file di un documento scelto sul telefono; restituisce l'id da collegare allo slot. */
    uploadDocument: async (tripId: string, doc: DocumentRef): Promise<string> => {
      const form = new FormData();
      form.append('title', doc.title);
      form.append('subtitle', doc.subtitle);
      form.append('file', await filePart(doc.uri, fileName(doc), fileType(doc)), fileName(doc));
      const { document } = await apiRequest<{ document: DocumentDto }>(
        options,
        'POST',
        `/api/trips/${tripId}/documents`,
        form,
      );
      return document.id;
    },

    putStay: (tripId: string, dayId: DayId, body: StayBody) =>
      unwrap(api.PUT('/api/trips/{tripId}/days/{day}/stay', { params: { path: { tripId, day: dayIndexOf(dayId) } }, body })),
    deleteStay: (tripId: string, dayId: DayId) =>
      unwrap(api.DELETE('/api/trips/{tripId}/days/{day}/stay', { params: { path: { tripId, day: dayIndexOf(dayId) } } })),

    createActivity: (tripId: string, dayId: DayId, body: ActivityBody) =>
      unwrap(
        api.POST('/api/trips/{tripId}/days/{day}/activities', {
          params: { path: { tripId, day: dayIndexOf(dayId) } },
          body,
        }),
      ),
    updateActivity: (tripId: string, activityId: string, body: ActivityPatch) =>
      unwrap(api.PATCH('/api/trips/{tripId}/activities/{activityId}', { params: { path: { tripId, activityId } }, body })),
    deleteActivity: (tripId: string, activityId: string) =>
      unwrap(api.DELETE('/api/trips/{tripId}/activities/{activityId}', { params: { path: { tripId, activityId } } })),

    createTransport: (tripId: string, body: TransportBody) =>
      unwrap(api.POST('/api/trips/{tripId}/transports', { ...tripPath(tripId), body })),
    putTransport: (tripId: string, transportId: string, body: TransportBody) =>
      unwrap(api.PUT('/api/trips/{tripId}/transports/{transportId}', { params: { path: { tripId, transportId } }, body })),
    deleteTransport: (tripId: string, transportId: string) =>
      unwrap(api.DELETE('/api/trips/{tripId}/transports/{transportId}', { params: { path: { tripId, transportId } } })),

    putInsurance: (tripId: string, body: InsuranceBody) =>
      unwrap(api.PUT('/api/trips/{tripId}/insurance', { ...tripPath(tripId), body })),
    deleteInsurance: (tripId: string) => unwrap(api.DELETE('/api/trips/{tripId}/insurance', tripPath(tripId))),
    putCustoms: (tripId: string, body: CustomsBody) =>
      unwrap(api.PUT('/api/trips/{tripId}/customs', { ...tripPath(tripId), body })),
    deleteCustoms: (tripId: string) => unwrap(api.DELETE('/api/trips/{tripId}/customs', tripPath(tripId))),

    createNote: (tripId: string, note: { dayId: DayId; visibility: MemoryVisibility; text: string; mood: NoteMood }) =>
      unwrap(
        api.POST('/api/trips/{tripId}/memories', {
          ...tripPath(tripId),
          // Le note viaggiano in JSON: la specifica descrive solo l'upload multipart.
          body: {
            kind: 'note',
            dayIndex: dayIndexOf(note.dayId),
            visibility: note.visibility,
            text: note.text,
            mood: toApiMood(note.mood),
          } as never,
        }),
      ),

    uploadMemory: async (
      tripId: string,
      media: { dayId: DayId; visibility: MemoryVisibility; caption: string; uri: string },
    ) => {
      const form = new FormData();
      form.append('dayIndex', String(dayIndexOf(media.dayId)));
      form.append('visibility', media.visibility);
      if (media.caption) form.append('caption', media.caption);
      const isVideo = /\.(mp4|mov)$/i.test(media.uri);
      const name = isVideo ? 'ricordo.mp4' : 'ricordo.jpg';
      form.append('file', await filePart(media.uri, name, isVideo ? 'video/mp4' : 'image/jpeg'), name);
      await apiRequest(options, 'POST', `/api/trips/${tripId}/memories`, form);
    },

    updateNote: (tripId: string, memoryId: string, text: string) =>
      unwrap(api.PATCH('/api/trips/{tripId}/memories/{memoryId}', { params: { path: { tripId, memoryId } }, body: { text } })),
    deleteMemory: (tripId: string, memoryId: string) =>
      unwrap(api.DELETE('/api/trips/{tripId}/memories/{memoryId}', { params: { path: { tripId, memoryId } } })),

    /** `null` toglie la reazione. */
    setReaction: (tripId: string, memoryId: string, reaction: ReactionKey | null) => {
      const params = { params: { path: { tripId, memoryId } } };
      return reaction
        ? unwrap(api.PUT('/api/trips/{tripId}/memories/{memoryId}/reaction', { ...params, body: { reaction: toApiReaction(reaction) } }))
        : unwrap(api.DELETE('/api/trips/{tripId}/memories/{memoryId}/reaction', params));
    },

    /** Da riferimento `api:` a URL firmato da scaricare o mostrare. */
    resolveFileUrl: async (uri: string): Promise<string> => {
      const path = signedUrlPathFor(uri);
      if (!path) return uri;
      return (await apiRequest<{ url: string }>(options, 'GET', path)).url;
    },
  };
}

