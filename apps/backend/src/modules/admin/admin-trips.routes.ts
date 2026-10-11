import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { AppError, notFound } from '../../lib/errors.js';
import { addMember, assertNotLastCoordinator } from '../crew/membership.js';
import { generateInviteCode } from '../trips/invite-code.js';
import { lockTrip } from '../trips/trip-lock.js';
import { tripStatusWhere, utcToday } from '../trips/trip-status.js';
import { lastSeenByUser } from './metrics.js';
import {
  adminTripInclude,
  loadAdminTripDetail,
  memberRowSelect,
  searchWhere,
  toAdminMember,
  toAdminTripSummary,
} from './admin-trips.js';
import {
  AddMemberBody,
  AdminCreateTripBody,
  AdminMemberDto,
  AdminMemberParams,
  AdminTodayQuery,
  AdminTripDetailDto,
  AdminTripParams,
  AdminTripsQuery,
  AdminTripSummaryDto,
  UpdateMemberRoleBody,
} from './admin.schemas.js';

export const adminTripsRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Tutti i viaggi, con filtro per stato e ricerca per titolo o destinazione.
   * I futuri e quelli in corso dal più vicino, i passati dal più recente.
   */
  app.get(
    '/trips',
    {
      schema: {
        querystring: AdminTripsQuery,
        response: { 200: z.object({ trips: z.array(AdminTripSummaryDto), total: z.number().int() }) },
      },
    },
    async (request) => {
      const { status, q, limit, offset } = request.query;
      const today = request.query.today ?? utcToday();
      const where = {
        AND: [
          ...(status ? [tripStatusWhere(status, today)] : []),
          ...searchWhere(q, ['title', 'destination']),
        ],
      };
      const direction = status === 'past' || !status ? 'desc' : 'asc';

      const [trips, total] = await Promise.all([
        app.prisma.trip.findMany({
          where,
          include: adminTripInclude,
          orderBy: [{ startDate: direction }, { id: 'asc' }],
          take: limit,
          skip: offset,
        }),
        app.prisma.trip.count({ where }),
      ]);

      return { trips: trips.map((trip) => toAdminTripSummary(trip, today)), total };
    },
  );

  app.get(
    '/trips/:tripId',
    {
      schema: {
        params: AdminTripParams,
        querystring: AdminTodayQuery,
        response: { 200: z.object({ trip: AdminTripDetailDto }) },
      },
    },
    async (request) => {
      const trip = await loadAdminTripDetail(
        app.prisma,
        request.params.tripId,
        request.query.today ?? utcToday(),
      );
      if (!trip) throw notFound('Trip');
      return { trip };
    },
  );

  /**
   * Crea un viaggio con un coordinatore scelto fra le persone registrate: lo
   * staff organizza, ma non entra nella crew.
   */
  app.post(
    '/trips',
    {
      schema: {
        body: AdminCreateTripBody,
        querystring: AdminTodayQuery,
        response: { 201: z.object({ trip: AdminTripDetailDto }) },
      },
    },
    async (request, reply) => {
      const { coordinatorUserId, ...fields } = request.body;
      const coordinator = await app.prisma.user.findUnique({
        where: { id: coordinatorUserId },
        select: { id: true },
      });
      if (!coordinator) throw notFound('User');

      const created = await app.prisma.trip.create({
        data: {
          ...fields,
          inviteCode: generateInviteCode(fields.title),
          members: { create: { userId: coordinator.id, role: TripRole.coordinator } },
        },
      });

      request.log.info({ adminId: request.user.id, tripId: created.id }, 'Admin created a trip');
      const trip = await loadAdminTripDetail(app.prisma, created.id, request.query.today ?? utcToday());
      return reply.status(201).send({ trip: trip! });
    },
  );

  /**
   * Mette una persona già registrata in un viaggio, con il ruolo scelto. Valgono
   * le regole di chi entra col link: capienza rispettata e, se per la sua email
   * c'era un posto riservato, lo occupa.
   */
  app.post(
    '/trips/:tripId/members',
    {
      schema: {
        params: AdminTripParams,
        body: AddMemberBody,
        response: { 201: z.object({ member: AdminMemberDto }) },
      },
    },
    async (request, reply) => {
      const { tripId } = request.params;
      const { userId, role } = request.body;

      const member = await app.prisma.$transaction(async (tx) => {
        const trip = await tx.trip.findUnique({ where: { id: tripId }, select: { id: true } });
        if (!trip) throw notFound('Trip');
        const locked = await lockTrip(tx, tripId);
        const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
        if (!user) throw notFound('User');

        const outcome = await addMember(tx, locked, user, role);
        if (outcome === 'already-member') {
          throw new AppError(409, 'ALREADY_MEMBER', 'This person is already in the trip');
        }
        return tx.tripMember.findUniqueOrThrow({
          where: { tripId_userId: { tripId, userId } },
          select: memberRowSelect,
        });
      });

      request.log.info({ adminId: request.user.id, tripId, userId, role }, 'Admin added a trip member');
      return reply
        .status(201)
        .send({ member: toAdminMember(member, await lastSeenByUser(app.prisma, [userId])) });
    },
  );

  app.patch(
    '/trips/:tripId/members/:userId',
    {
      schema: {
        params: AdminMemberParams,
        body: UpdateMemberRoleBody,
        response: { 200: z.object({ member: AdminMemberDto }) },
      },
    },
    async (request) => {
      const { tripId, userId } = request.params;
      const { role } = request.body;

      const member = await app.prisma.$transaction(async (tx) => {
        const target = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } });
        if (!target) throw notFound('Member');
        if (target.role === TripRole.coordinator && role !== TripRole.coordinator) {
          await assertNotLastCoordinator(tx, tripId, userId);
        }
        return tx.tripMember.update({
          where: { tripId_userId: { tripId, userId } },
          data: { role },
          select: memberRowSelect,
        });
      });

      request.log.info({ adminId: request.user.id, tripId, userId, role }, 'Admin changed a member role');
      return { member: toAdminMember(member, await lastSeenByUser(app.prisma, [userId])) };
    },
  );

  app.delete(
    '/trips/:tripId/members/:userId',
    { schema: { params: AdminMemberParams } },
    async (request, reply) => {
      const { tripId, userId } = request.params;

      await app.prisma.$transaction(async (tx) => {
        const target = await tx.tripMember.findUnique({ where: { tripId_userId: { tripId, userId } } });
        if (!target) throw notFound('Member');
        await assertNotLastCoordinator(tx, tripId, userId);
        await tx.tripMember.delete({ where: { tripId_userId: { tripId, userId } } });
      });

      request.log.info({ adminId: request.user.id, tripId, userId }, 'Admin removed a trip member');
      return reply.status(204).send();
    },
  );
};
