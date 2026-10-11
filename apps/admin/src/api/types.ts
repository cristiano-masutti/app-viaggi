import type { paths } from './schema';

/**
 * Nomi brevi per i DTO del pannello, ricavati da `schema.d.ts` (generato da
 * `npm run api:types` a partire da `apps/backend/openapi.json`). Se il backend
 * cambia una risposta, `tsc` indica ogni punto del pannello da sistemare.
 */
type Json<T> = T extends { content: { 'application/json': infer Body } } ? Body : never;

export type AdminSession = Json<paths['/api/admin/session']['get']['responses'][200]>['admin'];
export type AdminOverview = Json<paths['/api/admin/overview']['get']['responses'][200]>;
export type AdminTripSummary = Json<paths['/api/admin/trips']['get']['responses'][200]>['trips'][number];
export type AdminTripDetail = Json<paths['/api/admin/trips/{tripId}']['get']['responses'][200]>['trip'];
export type AdminMember = AdminTripDetail['crew'][number];
export type AdminUser = Json<paths['/api/admin/users']['get']['responses'][200]>['users'][number];
export type AdminUserDetail = Json<paths['/api/admin/users/{userId}']['get']['responses'][200]>['user'];
export type CreatedAccount = Json<paths['/api/admin/users']['post']['responses'][201]>;

export type TripStatus = AdminTripSummary['status'];
export type ReadinessIssue = AdminTripSummary['readiness']['issues'][number];
export type TripRole = AdminMember['role'];

/** Il viaggio come lo modifica il coordinatore: le stesse API dell'app, con i documenti. */
export type TripPlan = Json<paths['/api/trips/{tripId}']['get']['responses'][200]>['trip'];
export type PlanDay = TripPlan['days'][number];
export type PlanActivity = PlanDay['activities'][number];
export type TripDocument = NonNullable<NonNullable<PlanDay['stay']>['doc']>;
export type PlanTransport = TripPlan['documents']['transports'][number];
export type TransportMode = PlanTransport['mode'];
export type PlanInsurance = NonNullable<TripPlan['documents']['insurance']>;
export type PlanCustoms = NonNullable<TripPlan['documents']['customs']>;
export type PlanEmergency = TripPlan['emergencies'][number];
export type PlanInvitation = TripPlan['invitations'][number];

/** Le metriche: uso dell'app (eventi legati alle persone) e prestazioni (campioni anonimi). */
export type AdminUsage = Json<paths['/api/admin/usage']['get']['responses'][200]>;
export type AdminPerformance = Json<paths['/api/admin/performance']['get']['responses'][200]>;
export type PerfMetric = AdminPerformance['metrics'][number]['metric'];
export type TelemetrySource = AdminPerformance['source'];
export type AppPlatform = AdminUsage['platforms'][number]['platform'];
export type TelemetryBatch = NonNullable<
  paths['/api/telemetry']['post']['requestBody']
>['content']['application/json'];
