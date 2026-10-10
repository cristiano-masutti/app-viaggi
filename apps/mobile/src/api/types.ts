import type { paths } from './schema';

/**
 * Nomi brevi per i DTO dell'API, ricavati da `schema.d.ts` (generato da
 * `npm run api:types` a partire da `apps/backend/openapi.json`). Se il backend
 * cambia una risposta, questi tipi cambiano e `tsc` segnala ogni punto del
 * mobile da sistemare.
 */
type Json<T> = T extends { content: { 'application/json': infer Body } } ? Body : never;

export type TripSummaryDto = Json<paths['/api/trips']['get']['responses'][200]>['trips'][number];
export type TripDetailDto = Json<paths['/api/trips/{tripId}']['get']['responses'][200]>['trip'];
export type MemberDto = TripDetailDto['crew'][number];
export type InvitationDto = TripDetailDto['invitations'][number];
export type DayDto = TripDetailDto['days'][number];
export type DocumentDto = NonNullable<NonNullable<DayDto['stay']>['doc']>;
export type MemoryDto = Json<paths['/api/trips/{tripId}/memories']['get']['responses'][200]>['memories'][number];
export type ProfileDto = Json<paths['/api/me']['get']['responses'][200]>['user'];

export type CreateTripBody = NonNullable<paths['/api/trips']['post']['requestBody']>['content']['application/json'];
export type UpdateProfileBody = NonNullable<paths['/api/me']['patch']['requestBody']>['content']['application/json'];

export type ApiReaction = NonNullable<Extract<MemoryDto, { reactions: unknown }>['myReaction']>;
export type ApiNoteMood = Extract<MemoryDto, { kind: 'note' }>['mood'];
