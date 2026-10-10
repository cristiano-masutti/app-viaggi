import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { todayISO } from '@/lib/dates';

import { useApi } from './ApiProvider';
import { unwrap } from './client';
import type { TripRole, TripStatus } from './types';

/**
 * Le letture e le azioni del pannello. Tutto sta sotto la chiave `admin`: dopo
 * un'azione si invalida quella, e ogni schermata aperta si riallinea al server.
 */
export const PAGE_SIZE = 20;

const keys = {
  all: ['admin'] as const,
  session: ['admin', 'session'] as const,
  overview: (today: string) => ['admin', 'overview', today] as const,
  trips: (params: object) => ['admin', 'trips', params] as const,
  trip: (tripId: string, today: string) => ['admin', 'trip', tripId, today] as const,
  users: (params: object) => ['admin', 'users', params] as const,
  user: (userId: string, today: string) => ['admin', 'user', userId, today] as const,
};

export function useAdminSession() {
  const api = useApi();
  return useQuery({
    queryKey: keys.session,
    queryFn: () => unwrap(api.GET('/api/admin/session')).then((data) => data.admin),
    // Un 403 è una risposta, non un guasto: niente tentativi ripetuti.
    retry: false,
    staleTime: Infinity,
  });
}

export function useOverview() {
  const api = useApi();
  const today = todayISO();
  return useQuery({
    queryKey: keys.overview(today),
    queryFn: () => unwrap(api.GET('/api/admin/overview', { params: { query: { today } } })),
  });
}

export function useTrips({ status, q, page }: { status?: TripStatus; q?: string; page: number }) {
  const api = useApi();
  const today = todayISO();
  const query = { status, q: q || undefined, today, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  return useQuery({
    queryKey: keys.trips(query),
    queryFn: () => unwrap(api.GET('/api/admin/trips', { params: { query } })),
    // Cambiando pagina o filtro la lista vecchia resta finché arriva la nuova: niente salti.
    placeholderData: keepPreviousData,
  });
}

export function useTrip(tripId: string) {
  const api = useApi();
  const today = todayISO();
  return useQuery({
    queryKey: keys.trip(tripId, today),
    queryFn: () =>
      unwrap(api.GET('/api/admin/trips/{tripId}', { params: { path: { tripId }, query: { today } } })).then(
        (data) => data.trip,
      ),
  });
}

export function useUsers({ q, page, enabled = true }: { q?: string; page: number; enabled?: boolean }) {
  const api = useApi();
  const query = { q: q || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  return useQuery({
    queryKey: keys.users(query),
    queryFn: () => unwrap(api.GET('/api/admin/users', { params: { query } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUser(userId: string) {
  const api = useApi();
  const today = todayISO();
  return useQuery({
    queryKey: keys.user(userId, today),
    queryFn: () =>
      unwrap(api.GET('/api/admin/users/{userId}', { params: { path: { userId }, query: { today } } })).then(
        (data) => data.user,
      ),
  });
}

/** Dopo un'azione si rilegge tutto il pannello: liste, dettagli e numeri della home. */
function useInvalidateAll() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: keys.all });
}

export function useAddMember(tripId: string) {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: { userId: string; role: TripRole }) =>
      unwrap(api.POST('/api/admin/trips/{tripId}/members', { params: { path: { tripId } }, body })),
    onSuccess: invalidate,
  });
}

export function useUpdateMemberRole(tripId: string) {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TripRole }) =>
      unwrap(
        api.PATCH('/api/admin/trips/{tripId}/members/{userId}', {
          params: { path: { tripId, userId } },
          body: { role },
        }),
      ),
    onSuccess: invalidate,
  });
}

export function useRemoveMember(tripId: string) {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (userId: string) =>
      unwrap(
        api.DELETE('/api/admin/trips/{tripId}/members/{userId}', { params: { path: { tripId, userId } } }),
      ),
    onSuccess: invalidate,
  });
}

export function useCreateAccount() {
  const api = useApi();
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: { email: string; firstName: string; lastName: string }) =>
      unwrap(api.POST('/api/admin/users', { body })),
    onSuccess: invalidate,
  });
}
