import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { isoDate, isoDateTime } from '../../lib/schemas.js';
import { INVITE_CODE_PATTERN } from '../trips/invite-code.js';

/** Ciò che un compagno di viaggio vede di un altro: mai email o dati del profilo. */
export const MemberDto = z.object({
  userId: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string().nullable(),
  role: z.enum(TripRole),
  joinedAt: isoDateTime,
});

export const InvitationDto = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string().nullable(),
  createdAt: isoDateTime,
});

export const InviteeInput = z.object({
  name: z.string().trim().min(1).max(60),
  email: z
    .email()
    .transform((email) => email.toLowerCase())
    .optional(),
});

export const AddInvitationsBody = z.object({ invitees: z.array(InviteeInput).min(1).max(50) });

export const InvitationParams = z.object({ tripId: z.uuid(), invitationId: z.uuid() });
export const MemberParams = z.object({ tripId: z.uuid(), userId: z.uuid() });
export const UpdateMemberBody = z.object({ role: z.enum(TripRole) });

export const InviteParams = z.object({ code: z.string().regex(INVITE_CODE_PATTERN) });

export const InvitePreviewDto = z.object({
  trip: z.object({
    id: z.uuid(),
    title: z.string(),
    startDate: isoDate,
    endDate: isoDate,
    totalDays: z.number().int(),
    crewCount: z.number().int(),
    crewCapacity: z.number().int().nullable(),
    coordinators: z.array(z.object({ firstName: z.string(), lastName: z.string() })),
  }),
  alreadyMember: z.boolean(),
});

/** Utenti esposti ai compagni di viaggio: la select che garantisce `MemberDto`. */
export const memberUserSelect = { firstName: true, lastName: true, username: true } as const;

export const toMemberDto = (member: {
  userId: string;
  role: TripRole;
  joinedAt: Date;
  user: { firstName: string; lastName: string; username: string | null };
}) => ({ userId: member.userId, role: member.role, joinedAt: member.joinedAt, ...member.user });
