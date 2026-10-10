import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Prisma } from '../../generated/prisma/client.js';
import { TripRole } from '../../generated/prisma/enums.js';
import { AppError, notFound } from '../../lib/errors.js';
import { generateInviteCode } from '../trips/invite-code.js';
import { COORDINATOR_ONLY, TripParams } from '../trips/trip-access.js';
import {
  AddInvitationsBody,
  InvitationDto,
  InvitationParams,
  MemberDto,
  memberUserSelect,
  MemberParams,
  toMemberDto,
  UpdateMemberBody,
} from './crew.schemas.js';

const lastCoordinator = () =>
  new AppError(409, 'LAST_COORDINATOR', 'A trip always needs a coordinator: promote someone else first');

/**
 * Un viaggio non resta mai senza coordinatore. Il controllo blocca la riga del
 * viaggio (FOR UPDATE), così due coordinatori che escono insieme non possono
 * lasciarlo vuoto passando entrambi il conteggio.
 */
async function assertNotLastCoordinator(tx: Prisma.TransactionClient, tripId: string, userId: string) {
  await tx.$queryRaw`SELECT 1 FROM "Trip" WHERE "id" = ${tripId}::uuid FOR UPDATE`;
  const coordinators = await tx.tripMember.findMany({
    where: { tripId, role: TripRole.coordinator },
    select: { userId: true },
  });
  if (coordinators.length === 1 && coordinators[0]?.userId === userId) throw lastCoordinator();
}

export const crewRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Posti riservati a persone che entreranno col link. */
  app.post(
    '/trips/:tripId/invitations',
    {
      config: COORDINATOR_ONLY,
      schema: {
        params: TripParams,
        body: AddInvitationsBody,
        response: { 201: z.object({ invitations: z.array(InvitationDto) }) },
      },
    },
    async (request, reply) => {
      const invitations = await app.prisma.tripInvitation.createManyAndReturn({
        data: request.body.invitees.map((invitee) => ({
          ...invitee,
          tripId: request.trip.id,
          invitedById: request.user.id,
        })),
      });
      return reply.status(201).send({ invitations });
    },
  );

  app.delete(
    '/trips/:tripId/invitations/:invitationId',
    { config: COORDINATOR_ONLY, schema: { params: InvitationParams } },
    async (request, reply) => {
      const { count } = await app.prisma.tripInvitation.deleteMany({
        where: { id: request.params.invitationId, tripId: request.trip.id },
      });
      if (count === 0) throw notFound('Invitation');
      return reply.status(204).send();
    },
  );

  app.patch(
    '/trips/:tripId/members/:userId',
    {
      config: COORDINATOR_ONLY,
      schema: {
        params: MemberParams,
        body: UpdateMemberBody,
        response: { 200: z.object({ member: MemberDto }) },
      },
    },
    async (request) => {
      const { tripId, userId } = request.params;

      const member = await app.prisma.$transaction(async (tx) => {
        const target = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } });
        if (!target) throw notFound('Member');
        if (target.role === TripRole.coordinator && request.body.role !== TripRole.coordinator) {
          await assertNotLastCoordinator(tx, tripId, userId);
        }
        return tx.tripMember.update({
          where: { tripId_userId: { tripId, userId } },
          data: { role: request.body.role },
          include: { user: { select: memberUserSelect } },
        });
      });

      return { member: toMemberDto(member) };
    },
  );

  /** Il coordinatore toglie qualcuno dal viaggio; per uscire da soli c'è `/leave`. */
  app.delete(
    '/trips/:tripId/members/:userId',
    { config: COORDINATOR_ONLY, schema: { params: MemberParams } },
    async (request, reply) => {
      const { tripId, userId } = request.params;

      await app.prisma.$transaction(async (tx) => {
        await assertNotLastCoordinator(tx, tripId, userId);
        const { count } = await tx.tripMember.deleteMany({ where: { tripId, userId } });
        if (count === 0) throw notFound('Member');
      });

      return reply.status(204).send();
    },
  );

  app.post('/trips/:tripId/leave', { schema: { params: TripParams } }, async (request, reply) => {
    const { tripId } = request.params;
    const userId = request.user.id;

    await app.prisma.$transaction(async (tx) => {
      await assertNotLastCoordinator(tx, tripId, userId);
      await tx.tripMember.delete({ where: { tripId_userId: { tripId, userId } } });
    });

    return reply.status(204).send();
  });

  /** Nuovo link di invito: quello vecchio smette subito di funzionare. */
  app.post(
    '/trips/:tripId/invite-code',
    {
      config: COORDINATOR_ONLY,
      schema: { params: TripParams, response: { 200: z.object({ inviteCode: z.string() }) } },
    },
    async (request) => {
      const { inviteCode } = await app.prisma.trip.update({
        where: { id: request.trip.id },
        data: { inviteCode: generateInviteCode(request.trip.title) },
        select: { inviteCode: true },
      });
      return { inviteCode };
    },
  );
};
