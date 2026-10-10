import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApi, useUploader } from './ApiProvider';
import { unwrap } from './client';
import { type DocumentChange, resolveDocumentId } from './documents';
import type { TransportMode } from './types';

/**
 * Organizzare un viaggio dal pannello: le stesse API che il coordinatore usa
 * dall'app (lo staff passa come coordinatore), quindi le stesse regole.
 * Ogni azione, riuscita, rilegge tutto il pannello.
 */

export function useTripPlan(tripId: string) {
  const api = useApi();
  return useQuery({
    queryKey: ['admin', 'plan', tripId],
    queryFn: () =>
      unwrap(api.GET('/api/trips/{tripId}', { params: { path: { tripId } } })).then((data) => data.trip),
  });
}

function useTripAction<Input, Output>(run: (input: Input) => Promise<Output>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });
}

/** Prima l'eventuale file nuovo, poi lo slot che lo usa. */
function useDocumentResolver(tripId: string) {
  const upload = useUploader();
  return (change: DocumentChange, title: string) =>
    resolveDocumentId(change, (file) => upload(tripId, file, title));
}

export function useSaveStay(tripId: string) {
  const api = useApi();
  const documentId = useDocumentResolver(tripId);
  return useTripAction(
    async ({
      day,
      name,
      address,
      document,
    }: {
      day: number;
      name: string;
      address: string;
      document: DocumentChange;
    }) =>
      unwrap(
        api.PUT('/api/trips/{tripId}/days/{day}/stay', {
          params: { path: { tripId, day } },
          body: { name, address, documentId: await documentId(document, 'Voucher di prenotazione') },
        }),
      ),
  );
}

export function useDeleteStay(tripId: string) {
  const api = useApi();
  return useTripAction((day: number) =>
    unwrap(api.DELETE('/api/trips/{tripId}/days/{day}/stay', { params: { path: { tripId, day } } })),
  );
}

export function useSaveActivity(tripId: string) {
  const api = useApi();
  const documentId = useDocumentResolver(tripId);
  return useTripAction(
    async ({
      activityId,
      day,
      name,
      place,
      document,
    }: {
      activityId?: string;
      day: number;
      name: string;
      place: string;
      document: DocumentChange;
    }) => {
      const body = { name, place, documentId: await documentId(document, 'Biglietto o voucher') };
      return activityId
        ? unwrap(
            api.PATCH('/api/trips/{tripId}/activities/{activityId}', {
              params: { path: { tripId, activityId } },
              body,
            }),
          )
        : unwrap(
            api.POST('/api/trips/{tripId}/days/{day}/activities', {
              params: { path: { tripId, day } },
              body,
            }),
          );
    },
  );
}

export function useDeleteActivity(tripId: string) {
  const api = useApi();
  return useTripAction((activityId: string) =>
    unwrap(
      api.DELETE('/api/trips/{tripId}/activities/{activityId}', { params: { path: { tripId, activityId } } }),
    ),
  );
}

export function useSaveInsurance(tripId: string) {
  const api = useApi();
  const documentId = useDocumentResolver(tripId);
  return useTripAction(
    async (input: {
      company: string;
      policy: string;
      coverage: string;
      emergencyPhone: string;
      document: DocumentChange;
    }) => {
      const { document, ...fields } = input;
      return unwrap(
        api.PUT('/api/trips/{tripId}/insurance', {
          params: { path: { tripId } },
          body: { ...fields, documentId: await documentId(document, 'Polizza assicurativa') },
        }),
      );
    },
  );
}

export function useDeleteInsurance(tripId: string) {
  const api = useApi();
  return useTripAction(() =>
    unwrap(api.DELETE('/api/trips/{tripId}/insurance', { params: { path: { tripId } } })),
  );
}

export function useSaveCustoms(tripId: string) {
  const api = useApi();
  const documentId = useDocumentResolver(tripId);
  return useTripAction(
    async ({ code, note, document }: { code: string; note: string; document: DocumentChange }) =>
      unwrap(
        api.PUT('/api/trips/{tripId}/customs', {
          params: { path: { tripId } },
          body: { code, note, documentId: await documentId(document, 'Modulo doganale') },
        }),
      ),
  );
}

export function useDeleteCustoms(tripId: string) {
  const api = useApi();
  return useTripAction(() =>
    unwrap(api.DELETE('/api/trips/{tripId}/customs', { params: { path: { tripId } } })),
  );
}

export interface TransportDocDraft {
  /** Presente se il documento del mezzo esiste già. */
  id?: string;
  label: string;
  document: DocumentChange;
}

export function useSaveTransport(tripId: string) {
  const api = useApi();
  const documentId = useDocumentResolver(tripId);
  return useTripAction(
    async ({
      transportId,
      name,
      reference,
      mode,
      docs,
    }: {
      transportId?: string;
      name: string;
      reference: string;
      mode: TransportMode;
      docs: TransportDocDraft[];
    }) => {
      const body = {
        name,
        reference,
        mode,
        docs: await Promise.all(
          docs.map(async (doc) => ({
            id: doc.id,
            label: doc.label,
            documentId: await documentId(doc.document, doc.label),
          })),
        ),
      };
      return transportId
        ? unwrap(
            api.PUT('/api/trips/{tripId}/transports/{transportId}', {
              params: { path: { tripId, transportId } },
              body,
            }),
          )
        : unwrap(api.POST('/api/trips/{tripId}/transports', { params: { path: { tripId } }, body }));
    },
  );
}

export function useDeleteTransport(tripId: string) {
  const api = useApi();
  return useTripAction((transportId: string) =>
    unwrap(
      api.DELETE('/api/trips/{tripId}/transports/{transportId}', {
        params: { path: { tripId, transportId } },
      }),
    ),
  );
}

export interface EmergencyDraft {
  title: string;
  subtitle: string;
  actionLabel: string;
  phone: string;
  whatsapp: boolean;
}

export function useSaveEmergencies(tripId: string) {
  const api = useApi();
  return useTripAction((contacts: EmergencyDraft[]) =>
    unwrap(api.PUT('/api/trips/{tripId}/emergencies', { params: { path: { tripId } }, body: { contacts } })),
  );
}

export function useUpdateTrip(tripId: string) {
  const api = useApi();
  return useTripAction(
    (body: {
      title: string;
      destination: string | null;
      startDate: string;
      endDate: string;
      crewCapacity: number | null;
    }) => unwrap(api.PATCH('/api/trips/{tripId}', { params: { path: { tripId } }, body })),
  );
}

export function useDeleteTrip(tripId: string) {
  const api = useApi();
  return useTripAction(() => unwrap(api.DELETE('/api/trips/{tripId}', { params: { path: { tripId } } })));
}

export function useAddInvitations(tripId: string) {
  const api = useApi();
  return useTripAction((invitees: Array<{ name: string; email?: string }>) =>
    unwrap(api.POST('/api/trips/{tripId}/invitations', { params: { path: { tripId } }, body: { invitees } })),
  );
}

export function useDeleteInvitation(tripId: string) {
  const api = useApi();
  return useTripAction((invitationId: string) =>
    unwrap(
      api.DELETE('/api/trips/{tripId}/invitations/{invitationId}', {
        params: { path: { tripId, invitationId } },
      }),
    ),
  );
}

export function useRegenerateInviteCode(tripId: string) {
  const api = useApi();
  return useTripAction(() =>
    unwrap(api.POST('/api/trips/{tripId}/invite-code', { params: { path: { tripId } } })),
  );
}

export function useCreateTrip() {
  const api = useApi();
  return useTripAction(
    (body: {
      title: string;
      destination?: string;
      startDate: string;
      endDate: string;
      crewCapacity?: number;
      coordinatorUserId: string;
    }) => unwrap(api.POST('/api/admin/trips', { body })).then((data) => data.trip),
  );
}

/**
 * Apre un documento in una scheda nuova. La scheda si apre subito, al clic,
 * e riceve l'indirizzo firmato appena arriva: così il browser non la blocca.
 */
export function useOpenDocument(tripId: string) {
  const api = useApi();
  return async (documentId: string) => {
    const tab = window.open('', '_blank');
    try {
      const { url } = await unwrap(
        api.GET('/api/trips/{tripId}/documents/{documentId}/url', {
          params: { path: { tripId, documentId } },
        }),
      );
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      tab?.close();
      throw error;
    }
  };
}
