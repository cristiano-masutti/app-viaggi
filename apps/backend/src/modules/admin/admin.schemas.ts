import { z } from 'zod';

import {
  AppPlatform,
  PerfMetric,
  TelemetrySource,
  TransportMode,
  TripRole,
} from '../../generated/prisma/enums.js';
import { isoDate, isoDateTime } from '../../lib/schemas.js';
import { InvitationDto } from '../crew/crew.schemas.js';
import { TRIP_STATUSES } from '../trips/trip-status.js';
import { CrewCapacity, Destination, Title, validDates } from '../trips/trips.schemas.js';
import { isTimeZone } from './metrics.js';
import { READINESS_ISSUES } from './readiness.js';

/**
 * Il pannello di controllo dello staff. Vede tutti i viaggi e tutte le persone,
 * ma dei profili solo ciò che serve a organizzare: mai note mediche, codice
 * fiscale, numero di passaporto o contenuti dei ricordi.
 */

export const TripStatusEnum = z.enum(TRIP_STATUSES);

const Today = isoDate.optional().meta({
  description: 'La data di oggi per chi guarda (decide in corso / futuri / passati). Senza: la data UTC.',
});

const Paging = {
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
};

/** Ricerca libera: ogni parola deve comparire in uno dei campi. */
const Search = z.string().trim().max(100).optional();

export const AdminTodayQuery = z.object({ today: Today });

export const AdminTripsQuery = z.object({
  status: TripStatusEnum.optional(),
  q: Search,
  today: Today,
  ...Paging,
});

export const AdminUsersQuery = z.object({ q: Search, today: Today, ...Paging });

export const AdminTripParams = z.object({ tripId: z.uuid() });
export const AdminUserParams = z.object({ userId: z.uuid() });
export const AdminMemberParams = z.object({ tripId: z.uuid(), userId: z.uuid() });

export const ReadinessDto = z.object({
  stays: z.object({ covered: z.number().int(), needed: z.number().int() }),
  insurance: z.boolean(),
  transport: z.boolean(),
  emergencyContacts: z.boolean(),
  passports: z.object({ ready: z.number().int(), total: z.number().int(), expiring: z.number().int() }),
  issues: z.array(z.enum(READINESS_ISSUES)),
});

const PersonRef = z.object({ userId: z.uuid(), firstName: z.string(), lastName: z.string() });

/** Solo se c'è e quando scade: il numero resta nel profilo. */
const PassportStatus = z.object({ present: z.boolean(), expiry: z.string().nullable() });

export const AdminTripSummaryDto = z.object({
  id: z.uuid(),
  title: z.string(),
  destination: z.string().nullable(),
  startDate: isoDate,
  endDate: isoDate,
  totalDays: z.number().int(),
  status: TripStatusEnum,
  crewCapacity: z.number().int().nullable(),
  members: z.number().int(),
  pendingInvitations: z.number().int(),
  coordinators: z.array(PersonRef),
  /** Foto e video, privati compresi: è un conteggio, non un accesso. */
  mediaCount: z.number().int(),
  readiness: ReadinessDto,
});

export const AdminMemberDto = PersonRef.extend({
  username: z.string().nullable(),
  email: z.string().nullable(),
  role: z.enum(TripRole),
  joinedAt: isoDateTime,
  passport: PassportStatus,
  /** L'ultima volta che ha usato l'app; `null` se non ci è mai entrato. */
  lastSeenAt: isoDateTime.nullable(),
});

export const AdminTripDetailDto = AdminTripSummaryDto.extend({
  inviteCode: z.string(),
  createdAt: isoDateTime,
  crew: z.array(AdminMemberDto),
  invitations: z.array(InvitationDto),
  days: z.array(
    z.object({
      index: z.number().int(),
      date: isoDate,
      stay: z.object({ name: z.string(), address: z.string(), hasDocument: z.boolean() }).nullable(),
      activities: z.array(
        z.object({ id: z.uuid(), name: z.string(), place: z.string(), hasDocument: z.boolean() }),
      ),
    }),
  ),
  logistics: z.object({
    insurance: z
      .object({ company: z.string(), policy: z.string(), coverage: z.string(), emergencyPhone: z.string() })
      .nullable(),
    customs: z.object({ code: z.string(), note: z.string() }).nullable(),
    transports: z.array(
      z.object({ id: z.uuid(), name: z.string(), reference: z.string(), mode: z.enum(TransportMode) }),
    ),
    emergencies: z.array(z.object({ id: z.uuid(), title: z.string(), phone: z.string() })),
  }),
  memories: z.object({ photos: z.number().int(), videos: z.number().int(), notes: z.number().int() }),
});

export const AdminUserDto = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string().nullable(),
  isAdmin: z.boolean(),
  createdAt: isoDateTime,
  tripCount: z.number().int(),
  passport: PassportStatus,
  /** L'ultima volta che ha usato l'app; `null` se non ci è mai entrato. */
  lastSeenAt: isoDateTime.nullable(),
});

export const AdminUserDetailDto = AdminUserDto.extend({
  /** Gli ultimi 30 giorni nell'app. */
  usage: z.object({
    appOpens: z.number().int(),
    screenViews: z.number().int(),
    documentOpens: z.number().int(),
  }),
  trips: z.array(
    z.object({
      tripId: z.uuid(),
      title: z.string(),
      startDate: isoDate,
      endDate: isoDate,
      status: TripStatusEnum,
      role: z.enum(TripRole),
      joinedAt: isoDateTime,
    }),
  ),
});

export const AdminOverviewDto = z.object({
  today: isoDate,
  trips: z.object({ ongoing: z.number().int(), upcoming: z.number().int(), past: z.number().int() }),
  /** Persone dentro almeno un viaggio in corso o futuro. */
  activeTravellers: z.number().int(),
  people: z.object({ total: z.number().int(), withoutTrips: z.number().int() }),
  /** Viaggi in corso e futuri con una capienza: posti occupati (riserve comprese) sul totale. */
  seats: z.object({ taken: z.number().int(), capacity: z.number().int() }),
  memoriesThisWeek: z.number().int(),
  /** Le prossime partenze (60 giorni), dalla più vicina. */
  departures: z.array(AdminTripSummaryDto),
  /** Viaggi in corso o futuri con qualcosa da sistemare, dal più vicino. */
  attention: z.array(AdminTripSummaryDto),
});

export const AdminSessionDto = z.object({
  admin: z.object({
    id: z.uuid(),
    email: z.string().nullable(),
    firstName: z.string(),
    lastName: z.string(),
  }),
});

const Name = z.string().trim().min(1).max(60);

export const CreateAccountBody = z.object({
  email: z
    .email()
    .max(254)
    .transform((email) => email.toLowerCase()),
  firstName: Name,
  lastName: Name,
});

export const CreateAccountResponse = z.object({
  user: AdminUserDto,
  /** Da consegnare alla persona: il server non la conserva e non la mostra più. */
  temporaryPassword: z.string(),
});

export const AddMemberBody = z.object({ userId: z.uuid(), role: z.enum(TripRole).default('traveller') });
export const UpdateMemberRoleBody = z.object({ role: z.enum(TripRole) });

/** Un viaggio creato dallo staff: il coordinatore è una persona scelta, non chi lo crea. */
export const AdminCreateTripBody = validDates(
  z.object({
    title: Title,
    destination: Destination.optional(),
    startDate: isoDate,
    endDate: isoDate,
    crewCapacity: CrewCapacity.optional(),
    coordinatorUserId: z.uuid(),
  }),
);

/* ── Metriche ─────────────────────────────────────────────────────────── */

const TimeZone = z
  .string()
  .max(64)
  .refine(isTimeZone, 'Unknown time zone')
  .default('UTC')
  .meta({ description: 'Fuso di chi guarda: i giorni delle serie sono i suoi (es. Europe/Rome).' });

export const AdminMetricsQuery = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
  today: isoDate.optional(),
  tz: TimeZone,
});

export const AdminPerformanceQuery = AdminMetricsQuery.extend({
  source: z.enum(TelemetrySource).default('app'),
});

const PersonLastSeen = z.object({
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable(),
  /** `null` = non è mai entrato nell'app. */
  lastSeenAt: isoDateTime.nullable(),
  /** Il suo prossimo viaggio (o quello in corso). */
  trip: z.object({ tripId: z.uuid(), title: z.string(), startDate: isoDate }),
});

export const AdminUsageDto = z.object({
  from: isoDate,
  to: isoDate,
  activeUsers: z.object({ today: z.number().int(), week: z.number().int(), month: z.number().int() }),
  /** Persone con un account, staff escluso: il denominatore degli attivi. */
  people: z.number().int(),
  daily: z.array(
    z.object({
      day: isoDate,
      activeUsers: z.number().int(),
      appOpens: z.number().int(),
      documentOpens: z.number().int(),
    }),
  ),
  screens: z.array(z.object({ screen: z.string(), views: z.number().int(), users: z.number().int() })),
  platforms: z.array(z.object({ platform: z.enum(AppPlatform), users: z.number().int() })),
  /** Chi è in un viaggio in corso o futuro ma non apre l'app da 14 giorni, o mai. */
  inactive: z.object({ total: z.number().int(), people: z.array(PersonLastSeen) }),
  /** Viaggi in corso: quanti della crew hanno usato l'app negli ultimi 7 giorni. */
  liveTrips: z.array(
    z.object({
      tripId: z.uuid(),
      title: z.string(),
      members: z.number().int(),
      activeMembers: z.number().int(),
      documentOpens: z.number().int(),
    }),
  ),
});

const Percentiles = {
  count: z.number().int(),
  p50: z.number(),
  p75: z.number(),
  p95: z.number(),
};

export const AdminPerformanceDto = z.object({
  source: z.enum(TelemetrySource),
  from: isoDate,
  to: isoDate,
  metrics: z.array(z.object({ metric: z.enum(PerfMetric), ...Percentiles })),
  daily: z.array(
    z.object({ day: isoDate, metric: z.enum(PerfMetric), p75: z.number(), count: z.number().int() }),
  ),
  /** Per schermata, pagina o chiamata: dove si perde tempo. */
  targets: z.array(z.object({ metric: z.enum(PerfMetric), target: z.string(), ...Percentiles })),
  platforms: z.array(
    z.object({
      platform: z.enum(AppPlatform),
      metric: z.enum(PerfMetric),
      p75: z.number(),
      count: z.number().int(),
    }),
  ),
});
