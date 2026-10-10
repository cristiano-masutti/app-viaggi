import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { AppError, notFound } from '../../lib/errors.js';
import { addMember, assertNotLastCoordinator } from '../crew/membership.js';
import { dayDate } from '../trips/days.js';
import { lockTrip } from '../trips/trip-lock.js';
import { tripStatusWhere, utcToday } from '../trips/trip-status.js';
import { adminTripInclude, passportStatus, searchWhere, toAdminTripSummary } from './admin-trips.js';
import {
  AddMemberBody,
  AdminMemberDto,
  AdminMemberParams,
  AdminTodayQuery,
  AdminTripDetailDto,
  AdminTripParams,
  AdminTripsQuery,
  AdminTripSummaryDto,
  UpdateMemberRoleBody,
} from './admin.schemas.js';

const memberRowSelect = {
  userId: true,
  role: true,
  joinedAt: true,
  user: {
    select: {
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      passportNumber: true,
      passportExpiry: true,
    },
  },
} as const;

const toAdminMember = (member: {
  userId: string;
  role: TripRole;
  joinedAt: Date;
  user: {
    firstName: string;
    lastName: string;
    username: string | null;
    email: string | null;
    passportNumber: string | null;
    passportExpiry: string | null;
  };
}) => ({
  userId: member.userId,
  firstName: member.user.firstName,
  lastName: member.user.lastName,
  username: member.user.username,
  email: member.user.email,
  role: member.role,
  joinedAt: member.joinedAt,
  passport: passportStatus(member.user),
});

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
      const today = request.query.today ?? utcToday();
      const { tripId } = request.params;

      const [trip, memoriesByKind] = await Promise.all([
        app.prisma.trip.findUnique({
          where: { id: tripId },
          include: {
            ...adminTripInclude,
            members: { ...adminTripInclude.members, select: memberRowSelect },
            invitations: { where: { acceptedAt: null }, orderBy: [{ createdAt: 'asc' }, { name: 'asc' }] },
            stays: { select: { dayIndex: true, name: true, address: true, documentId: true } },
            activities: {
              select: { id: true, dayIndex: true, name: true, place: true, documentId: true },
              orderBy: [{ dayIndex: 'asc' }, { position: 'asc' }],
            },
            insurance: true,
            customs: true,
            transports: { orderBy: { position: 'asc' } },
            emergencies: { orderBy: { position: 'asc' } },
          },
        }),
        app.prisma.memory.groupBy({ by: ['kind'], where: { tripId }, _count: { _all: true } }),
      ]);
      if (!trip) throw notFound('Trip');

      const summary = toAdminTripSummary(trip, today);
      const staysByDay = new Map(trip.stays.map((stay) => [stay.dayIndex, stay]));
      const memories = (kind: string) => memoriesByKind.find((row) => row.kind === kind)?._count._all ?? 0;

      return {
        trip: {
          ...summary,
          inviteCode: trip.inviteCode,
          createdAt: trip.createdAt,
          crew: trip.members.map(toAdminMember),
          invitations: trip.invitations,
          days: Array.from({ length: summary.totalDays }, (_, offset) => {
            const index = offset + 1;
            const stay = staysByDay.get(index);
            return {
              index,
              date: dayDate(trip.startDate, index),
              stay: stay
                ? { name: stay.name, address: stay.address, hasDocument: stay.documentId !== null }
                : null,
              activities: trip.activities
                .filter((activity) => activity.dayIndex === index)
                .map(({ id, name, place, documentId }) => ({
                  id,
                  name,
                  place,
                  hasDocument: documentId !== null,
                })),
            };
          }),
          logistics: {
            insurance: trip.insurance,
            customs: trip.customs,
            transports: trip.transports,
            emergencies: trip.emergencies,
          },
          memories: { photos: memories('photo'), videos: memories('video'), notes: memories('note') },
        },
      };
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
      return reply.status(201).send({ member: toAdminMember(member) });
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
      return { member: toAdminMember(member) };
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
