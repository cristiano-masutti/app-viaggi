import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import {
  AccountAdminError,
  AccountExistsError,
  generateTemporaryPassword,
} from '../../auth/account-admin.js';
import { AppError, notFound } from '../../lib/errors.js';
import { tripStatus, utcToday } from '../trips/trip-status.js';
import { passportStatus, searchWhere } from './admin-trips.js';
import { lastSeenByUser } from './metrics.js';
import {
  AdminUserDetailDto,
  AdminUserDto,
  AdminUserParams,
  AdminUsersQuery,
  CreateAccountBody,
  CreateAccountResponse,
} from './admin.schemas.js';

/** I soli campi del profilo che il pannello legge: niente note mediche né codice fiscale. */
const userSelect = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  username: true,
  isAdmin: true,
  createdAt: true,
  passportNumber: true,
  passportExpiry: true,
  _count: { select: { memberships: true } },
} as const;

const toAdminUser = (
  {
    passportNumber,
    passportExpiry,
    _count,
    ...user
  }: {
    id: string;
    email: string | null;
    firstName: string;
    lastName: string;
    username: string | null;
    isAdmin: boolean;
    createdAt: Date;
    passportNumber: string | null;
    passportExpiry: string | null;
    _count: { memberships: number };
  },
  lastSeen: Map<string, Date> = new Map(),
) => ({
  ...user,
  tripCount: _count.memberships,
  passport: passportStatus({ passportNumber, passportExpiry }),
  lastSeenAt: lastSeen.get(user.id) ?? null,
});

const emailTaken = () => new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');

export const adminUsersRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Le persone, dalle più recenti: chi ha appena ricevuto le credenziali sta in cima. */
  app.get(
    '/users',
    {
      schema: {
        querystring: AdminUsersQuery,
        response: { 200: z.object({ users: z.array(AdminUserDto), total: z.number().int() }) },
      },
    },
    async (request) => {
      const { q, limit, offset } = request.query;
      const where = { AND: searchWhere(q, ['firstName', 'lastName', 'email', 'username']) };

      const [users, total] = await Promise.all([
        app.prisma.user.findMany({
          where,
          select: userSelect,
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: limit,
          skip: offset,
        }),
        app.prisma.user.count({ where }),
      ]);

      const lastSeen = await lastSeenByUser(
        app.prisma,
        users.map((user) => user.id),
      );
      return { users: users.map((user) => toAdminUser(user, lastSeen)), total };
    },
  );

  app.get(
    '/users/:userId',
    {
      schema: {
        params: AdminUserParams,
        querystring: z.object({ today: AdminUsersQuery.shape.today }),
        response: { 200: z.object({ user: AdminUserDetailDto }) },
      },
    },
    async (request) => {
      const today = request.query.today ?? utcToday();
      const user = await app.prisma.user.findUnique({
        where: { id: request.params.userId },
        select: {
          ...userSelect,
          memberships: {
            select: {
              role: true,
              joinedAt: true,
              trip: { select: { id: true, title: true, startDate: true, endDate: true } },
            },
            orderBy: [{ trip: { startDate: 'desc' } }, { tripId: 'asc' }],
          },
        },
      });
      if (!user) throw notFound('User');

      const { memberships, ...rest } = user;
      const [lastSeen, usage] = await Promise.all([
        lastSeenByUser(app.prisma, [user.id]),
        app.prisma.appEvent.groupBy({
          by: ['name'],
          where: { userId: user.id, occurredAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
          _count: { _all: true },
        }),
      ]);
      const count = (name: string) => usage.find((row) => row.name === name)?._count._all ?? 0;
      return {
        user: {
          ...toAdminUser(rest, lastSeen),
          usage: {
            appOpens: count('app_open'),
            screenViews: count('screen_view'),
            documentOpens: count('document_open'),
          },
          trips: memberships.map(({ role, joinedAt, trip }) => ({
            tripId: trip.id,
            title: trip.title,
            startDate: trip.startDate,
            endDate: trip.endDate,
            status: tripStatus(trip, today),
            role,
            joinedAt,
          })),
        },
      };
    },
  );

  /**
   * Crea l'account di una persona: su Supabase Auth con una password
   * provvisoria, e qui con nome e cognome, così compare subito nelle liste e
   * nelle crew. La password torna una volta sola: lo staff la consegna.
   */
  app.post(
    '/users',
    { schema: { body: CreateAccountBody, response: { 201: CreateAccountResponse } } },
    async (request, reply) => {
      const { email, firstName, lastName } = request.body;
      if (await app.prisma.user.count({ where: { email } })) throw emailTaken();

      const temporaryPassword = generateTemporaryPassword();
      let account: { id: string; email: string };
      try {
        account = await app.accountAdmin.createAccount({
          email,
          password: temporaryPassword,
          firstName,
          lastName,
        });
      } catch (error) {
        if (error instanceof AccountExistsError) throw emailTaken();
        if (error instanceof AccountAdminError) {
          throw new AppError(502, 'ACCOUNT_PROVIDER_ERROR', 'The account could not be created, try again', {
            cause: error,
          });
        }
        throw error;
      }

      let user;
      try {
        user = await app.prisma.user.upsert({
          where: { id: account.id },
          create: { id: account.id, email: account.email, firstName, lastName },
          update: { firstName, lastName },
          select: userSelect,
        });
      } catch (error) {
        // L'account su Supabase esiste già: senza la riga qui, ogni nuovo tentativo
        // direbbe "email già usata". Si annulla, così lo staff può riprovare.
        await app.accountAdmin.deleteAccount(account.id).catch((cleanup: unknown) => {
          request.log.error(
            { err: cleanup, accountId: account.id },
            'Orphan Supabase account: delete it by hand before retrying',
          );
        });
        throw error;
      }

      request.log.info({ adminId: request.user.id, userId: user.id }, 'Admin created an account');
      return reply.status(201).send({ user: toAdminUser(user), temporaryPassword });
    },
  );
};
