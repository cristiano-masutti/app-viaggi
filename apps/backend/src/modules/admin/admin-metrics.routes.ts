import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';

import type { AppPlatform, PerfMetric } from '../../generated/prisma/enums.js';
import {
  AdminMetricsQuery,
  AdminPerformanceDto,
  AdminPerformanceQuery,
  AdminUsageDto,
} from './admin.schemas.js';
import { addDays, coarseFrom, eachDay, lastSeenByUser, todayIn } from './metrics.js';

const DAY = 86_400_000;
/** Chi non apre l'app da più di così, durante un viaggio in corso o in arrivo, va cercato. */
const INACTIVE_AFTER_DAYS = 14;
const LIST_SIZE = 20;

/** Il giorno locale di un istante salvato in UTC (`timestamp` senza fuso). */
const LOCAL_DAY = (column: string) => `(("${column}" AT TIME ZONE 'UTC') AT TIME ZONE $1)::date`;

export const adminMetricsRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Come si usa l'app: attivi oggi, in 7 e in 30 giorni, l'andamento giorno per
   * giorno, le schermate, le piattaforme, e chi è in un viaggio ma non entra.
   */
  app.get(
    '/usage',
    { schema: { querystring: AdminMetricsQuery, response: { 200: AdminUsageDto } } },
    async (request) => {
      const { days, tz } = request.query;
      const to = request.query.today?.toISOString().slice(0, 10) ?? todayIn(tz);
      const from = addDays(to, -(days - 1));
      // Gli attivi del mese servono anche se la finestra è più corta.
      const since = coarseFrom(from < addDays(to, -29) ? from : addDays(to, -29));
      const events = `SELECT "userId", name, screen, platform, "tripId", ${LOCAL_DAY('occurredAt')} AS day
        FROM "AppEvent" WHERE "occurredAt" >= $2
          -- Lo staff che prova l'app non è uso: il denominatore (people) lo esclude, e così il numeratore.
          AND "userId" NOT IN (SELECT id FROM "User" WHERE "isAdmin")`;

      const [active] = await app.prisma.$queryRawUnsafe<
        Array<{ today: number; week: number; month: number }>
      >(
        `WITH e AS (${events})
         SELECT COUNT(DISTINCT "userId") FILTER (WHERE day = $3::date)::int AS today,
                COUNT(DISTINCT "userId") FILTER (WHERE day > $3::date - 7)::int AS week,
                COUNT(DISTINCT "userId") FILTER (WHERE day > $3::date - 30)::int AS month
         FROM e WHERE day <= $3::date`,
        tz,
        since,
        to,
      );
      const [daily, screens, platforms] = await Promise.all([
        app.prisma.$queryRawUnsafe<
          Array<{ day: Date; activeUsers: number; appOpens: number; documentOpens: number }>
        >(
          `WITH e AS (${events})
           SELECT day, COUNT(DISTINCT "userId")::int AS "activeUsers",
                  COUNT(*) FILTER (WHERE name = 'app_open')::int AS "appOpens",
                  COUNT(*) FILTER (WHERE name = 'document_open')::int AS "documentOpens"
           FROM e WHERE day BETWEEN $3::date AND $4::date GROUP BY day ORDER BY day`,
          tz,
          since,
          from,
          to,
        ),
        app.prisma.$queryRawUnsafe<Array<{ screen: string; views: number; users: number }>>(
          `WITH e AS (${events})
           SELECT screen, COUNT(*)::int AS views, COUNT(DISTINCT "userId")::int AS users
           FROM e WHERE name = 'screen_view' AND screen IS NOT NULL AND day BETWEEN $3::date AND $4::date
           GROUP BY screen ORDER BY views DESC, screen LIMIT 12`,
          tz,
          since,
          from,
          to,
        ),
        app.prisma.$queryRawUnsafe<Array<{ platform: AppPlatform; users: number }>>(
          `WITH e AS (${events})
           SELECT platform, COUNT(DISTINCT "userId")::int AS users
           FROM e WHERE day BETWEEN $3::date AND $4::date GROUP BY platform ORDER BY users DESC`,
          tz,
          since,
          from,
          to,
        ),
      ]);

      const toDay = (date: Date) => date.toISOString().slice(0, 10);
      const byDay = new Map(daily.map((row) => [toDay(row.day), row]));

      // Chi viaggia (in corso o presto) e da quanto non apre l'app.
      const todayDate = new Date(`${to}T00:00:00.000Z`);
      const memberships = await app.prisma.tripMember.findMany({
        where: { trip: { endDate: { gte: todayDate } } },
        select: {
          userId: true,
          trip: { select: { id: true, title: true, startDate: true, endDate: true } },
          user: { select: { firstName: true, lastName: true, email: true } },
        },
        orderBy: [{ trip: { startDate: 'asc' } }, { tripId: 'asc' }],
      });
      const lastSeen = await lastSeenByUser(app.prisma, [
        ...new Set(memberships.map((member) => member.userId)),
      ]);
      const inactiveSince = new Date(Date.now() - INACTIVE_AFTER_DAYS * DAY);
      const activeSince = new Date(Date.now() - 7 * DAY);

      const inactive = new Map<string, (typeof memberships)[number]>();
      for (const member of memberships) {
        const seen = lastSeen.get(member.userId);
        // Il primo viaggio in ordine di partenza è il più vicino: quello che conta.
        if ((!seen || seen < inactiveSince) && !inactive.has(member.userId))
          inactive.set(member.userId, member);
      }
      const inactivePeople = [...inactive.values()]
        .map((member) => ({
          userId: member.userId,
          ...member.user,
          lastSeenAt: lastSeen.get(member.userId) ?? null,
          trip: { tripId: member.trip.id, title: member.trip.title, startDate: member.trip.startDate },
        }))
        // Prima chi non è mai entrato, poi chi parte prima.
        .sort(
          (a, b) => Number(!!a.lastSeenAt) - Number(!!b.lastSeenAt) || +a.trip.startDate - +b.trip.startDate,
        );

      const liveTripIds = [
        ...new Set(
          memberships.filter((member) => member.trip.startDate <= todayDate).map((member) => member.trip.id),
        ),
      ];
      const documentOpens = await app.prisma.appEvent.groupBy({
        by: ['tripId'],
        where: {
          tripId: { in: liveTripIds },
          name: 'document_open',
          occurredAt: { gte: activeSince },
          user: { isAdmin: false },
        },
        _count: { _all: true },
      });
      const liveTrips = liveTripIds.map((tripId) => {
        const crew = memberships.filter((member) => member.trip.id === tripId);
        return {
          tripId,
          title: crew[0]!.trip.title,
          members: crew.length,
          activeMembers: crew.filter((member) => (lastSeen.get(member.userId) ?? 0) >= activeSince).length,
          documentOpens: documentOpens.find((row) => row.tripId === tripId)?._count._all ?? 0,
        };
      });

      return {
        from: new Date(`${from}T00:00:00.000Z`),
        to: todayDate,
        activeUsers: active ?? { today: 0, week: 0, month: 0 },
        people: await app.prisma.user.count({ where: { isAdmin: false } }),
        daily: eachDay(from, to).map((day) => ({
          day: new Date(`${day}T00:00:00.000Z`),
          activeUsers: byDay.get(day)?.activeUsers ?? 0,
          appOpens: byDay.get(day)?.appOpens ?? 0,
          documentOpens: byDay.get(day)?.documentOpens ?? 0,
        })),
        screens,
        platforms,
        inactive: { total: inactivePeople.length, people: inactivePeople.slice(0, LIST_SIZE) },
        liveTrips,
      };
    },
  );

  /**
   * Quanto è veloce e fluido il prodotto: mediana, p75 e p95 di ogni metrica,
   * il p75 giorno per giorno, e dove si perde tempo (schermate, pagine, chiamate).
   */
  app.get(
    '/performance',
    { schema: { querystring: AdminPerformanceQuery, response: { 200: AdminPerformanceDto } } },
    async (request) => {
      const { days, tz, source } = request.query;
      const to = request.query.today?.toISOString().slice(0, 10) ?? todayIn(tz);
      const from = addDays(to, -(days - 1));
      const samples = `SELECT metric, target, platform, value, ${LOCAL_DAY('occurredAt')} AS day
        FROM "PerfSample"
        WHERE "occurredAt" >= $2 AND source = $3::"TelemetrySource"`;
      const window = `day BETWEEN $4::date AND $5::date`;
      const percentiles = `COUNT(*)::int AS count,
        percentile_cont(0.5) WITHIN GROUP (ORDER BY value) AS p50,
        percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY value) AS p95`;
      const params = [tz, coarseFrom(from), source, from, to] as const;

      type Row = { metric: PerfMetric; count: number; p50: number; p75: number; p95: number };
      const [metrics, daily, targets, platforms] = await Promise.all([
        app.prisma.$queryRawUnsafe<Row[]>(
          `WITH s AS (${samples}) SELECT metric, ${percentiles} FROM s WHERE ${window} GROUP BY metric ORDER BY metric`,
          ...params,
        ),
        app.prisma.$queryRawUnsafe<Array<{ day: Date; metric: PerfMetric; p75: number; count: number }>>(
          `WITH s AS (${samples})
           SELECT day, metric, percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75, COUNT(*)::int AS count
           FROM s WHERE ${window} GROUP BY day, metric ORDER BY day, metric`,
          ...params,
        ),
        app.prisma.$queryRawUnsafe<Array<Row & { target: string }>>(
          `WITH s AS (${samples})
           SELECT metric, target, ${percentiles} FROM s
           WHERE ${window} AND target IS NOT NULL AND metric IN ('screen_ready', 'api_latency', 'lcp', 'inp')
           GROUP BY metric, target ORDER BY p75 DESC, target LIMIT 40`,
          ...params,
        ),
        app.prisma.$queryRawUnsafe<
          Array<{ platform: AppPlatform; metric: PerfMetric; p75: number; count: number }>
        >(
          `WITH s AS (${samples})
           SELECT platform, metric, percentile_cont(0.75) WITHIN GROUP (ORDER BY value) AS p75, COUNT(*)::int AS count
           FROM s WHERE ${window} GROUP BY platform, metric ORDER BY platform, metric`,
          ...params,
        ),
      ]);

      return {
        source,
        from: new Date(`${from}T00:00:00.000Z`),
        to: new Date(`${to}T00:00:00.000Z`),
        metrics,
        daily,
        targets,
        platforms,
      };
    },
  );
};
