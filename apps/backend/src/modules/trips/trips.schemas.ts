import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { isoDate, isoDateTime } from '../../lib/schemas.js';
import { InvitationDto, InviteeInput, MemberDto } from '../crew/crew.schemas.js';
import { ActivityDto, StayDto } from '../itinerary/itinerary.schemas.js';
import {
  CustomsDto,
  EmergencyDto,
  EmergencyInput,
  InsuranceDto,
  TransportDto,
} from '../logistics/logistics.schemas.js';
import { PassportDto } from '../me/me.schemas.js';
import { countDays, MAX_TRIP_DAYS } from './days.js';

const Title = z.string().trim().min(2).max(120);
const Destination = z.string().trim().min(2).max(120);
const CrewCapacity = z.number().int().min(1).max(200);

const validDates = <T extends { startDate: Date; endDate: Date }>(schema: z.ZodType<T>) =>
  schema
    .refine((trip) => trip.endDate >= trip.startDate, {
      path: ['endDate'],
      message: 'endDate must be on or after startDate',
    })
    .refine((trip) => countDays(trip.startDate, trip.endDate) <= MAX_TRIP_DAYS, {
      path: ['endDate'],
      message: `A trip lasts at most ${MAX_TRIP_DAYS} days`,
    });

/**
 * La bozza di `CreateTripScreen`. Chi crea il viaggio ne è il coordinatore;
 * le persone elencate in `invitees` diventano posti riservati in attesa che
 * entrino col link, e `emergencies` sono le card SOS iniziali.
 */
export const CreateTripBody = validDates(
  z.object({
    title: Title,
    destination: Destination.optional(),
    startDate: isoDate,
    endDate: isoDate,
    crewCapacity: CrewCapacity.optional(),
    invitees: z.array(InviteeInput).max(50).default([]),
    emergencies: z.array(EmergencyInput).max(10).default([]),
  }),
);

export const UpdateTripBody = z.object({
  title: Title.optional(),
  destination: Destination.nullable().optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  crewCapacity: CrewCapacity.nullable().optional(),
});

const TripBaseDto = z.object({
  id: z.uuid(),
  title: z.string(),
  destination: z.string().nullable(),
  startDate: isoDate,
  endDate: isoDate,
  totalDays: z.number().int(),
  crewCapacity: z.number().int().nullable(),
  /** Il ruolo di chi chiede: il client decide cosa mostrare come modificabile. */
  myRole: z.enum(TripRole),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

/** Card dell'hub "I Miei Viaggi". Lo stato (in corso, futuro, passato) lo calcola il client. */
export const TripSummaryDto = TripBaseDto.extend({
  crewCount: z.number().int(),
  /** Foto e video che chi chiede può vedere. */
  mediaCount: z.number().int(),
});

export const DayDto = z.object({
  index: z.number().int(),
  date: isoDate,
  stay: StayDto.nullable(),
  activities: z.array(ActivityDto),
});

/** Tutto il viaggio tranne i ricordi, che si leggono a pagine da `/memories`. */
export const TripDetailDto = TripBaseDto.extend({
  /** Parte finale del link `vibemakers.travel/join/<inviteCode>`. */
  inviteCode: z.string(),
  crew: z.array(MemberDto),
  invitations: z.array(InvitationDto),
  days: z.array(DayDto),
  documents: z.object({
    /** Il Passaporto Master di chi chiede: ognuno vede il proprio. */
    passport: PassportDto.nullable(),
    customs: CustomsDto.nullable(),
    transports: z.array(TransportDto),
    insurance: InsuranceDto.nullable(),
  }),
  emergencies: z.array(EmergencyDto),
});

export const TripDetailResponse = z.object({ trip: TripDetailDto });
