import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import { tripStatusWhere, utcToday } from '../trips/trip-status.js';
import { adminMetricsRoutes } from './admin-metrics.routes.js';
import { adminTripsRoutes } from './admin-trips.routes.js';
import { adminTripInclude, toAdminTripSummary } from './admin-trips.js';
import { adminUsersRoutes } from './admin-users.routes.js';
import { AdminOverviewDto, AdminSessionDto, AdminTodayQuery } from './admin.schemas.js';

const DEPARTURES_WINDOW_DAYS = 60;
const LIST_SIZE = 8;
const DAY_MS = 86_400_000;

/** Il pannello di controllo dello staff. Le route stanno sotto `/api/admin`, dentro `adminScope`. */
export const adminRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Chi è entrato nel pannello: se non è staff, l'hook ha già risposto 403. */
  app.get('/session', { schema: { response: { 200: AdminSessionDto } } }, async (request) => {
    const admin = await app.prisma.user.findUniqueOrThrow({
      where: { id: request.user.id },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
    return { admin };
  });

  /**
   * Il colpo d'occhio della home: quanti viaggi, quante persone in giro, chi
   * parte presto e cosa manca. I viaggi in corso e futuri si leggono una volta
   * sola e da lì si ricava tutto; regge senza problemi qualche centinaio di
   * viaggi attivi, oltre conviene precalcolare.
   */
  app.get(
    '/overview',
    { schema: { querystring: AdminTodayQuery, response: { 200: AdminOverviewDto } } },
    async (request) => {
      const today = request.query.today ?? utcToday();
      const weekAgo = new Date(Date.now() - 7 * DAY_MS);
      const departuresUntil = new Date(today.getTime() + DEPARTURES_WINDOW_DAYS * DAY_MS);

      const [ongoing, upcoming, past, activeTrips, activeTravellers, people, withoutTrips, memoriesThisWeek] =
        await Promise.all([
          app.prisma.trip.count({ where: tripStatusWhere('ongoing', today) }),
          app.prisma.trip.count({ where: tripStatusWhere('upcoming', today) }),
          app.prisma.trip.count({ where: tripStatusWhere('past', today) }),
          app.prisma.trip.findMany({
            where: { endDate: { gte: today } },
            include: adminTripInclude,
            orderBy: [{ startDate: 'asc' }, { id: 'asc' }],
          }),
          app.prisma.tripMember.findMany({
            where: { trip: { endDate: { gte: today } } },
            distinct: ['userId'],
            select: { userId: true },
          }),
          // Lo staff non conta fra le persone: organizza, non viaggia (o non per questo).
          app.prisma.user.count({ where: { isAdmin: false } }),
          app.prisma.user.count({ where: { isAdmin: false, memberships: { none: {} } } }),
          app.prisma.memory.count({ where: { createdAt: { gte: weekAgo } } }),
        ]);

      const summaries = activeTrips.map((trip) => toAdminTripSummary(trip, today));
      const withCapacity = summaries.filter((trip) => trip.crewCapacity !== null);

      return {
        today,
        trips: { ongoing, upcoming, past },
        activeTravellers: activeTravellers.length,
        people: { total: people, withoutTrips },
        seats: {
          taken: withCapacity.reduce((sum, trip) => sum + trip.members + trip.pendingInvitations, 0),
          capacity: withCapacity.reduce((sum, trip) => sum + (trip.crewCapacity ?? 0), 0),
        },
        memoriesThisWeek,
        departures: summaries
          .filter((trip) => trip.status === 'upcoming' && trip.startDate <= departuresUntil)
          .slice(0, LIST_SIZE),
        attention: summaries.filter((trip) => trip.readiness.issues.length > 0).slice(0, LIST_SIZE),
      };
    },
  );

  await app.register(adminTripsRoutes);
  await app.register(adminUsersRoutes);
  await app.register(adminMetricsRoutes);
};
