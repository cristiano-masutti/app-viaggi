import { ArrowRight, CalendarClock, Plane, Users } from 'lucide-react';
import { Link } from 'react-router';

import { useAdminSession, useOverview, useTrips } from '@/api/queries';
import type { AdminTripSummary } from '@/api/types';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { ReadinessChips } from '@/components/trips/ReadinessChips';
import { TripRowSkeleton } from '@/components/trips/TripRow';
import { Badge } from '@/components/ui/Badge';
import { Card, SectionLabel } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Meter } from '@/components/ui/Meter';
import { QueryError } from '@/components/ui/QueryError';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { dateRange, longDate, shortDate, todayISO } from '@/lib/dates';
import { coordinatorsLabel, fillRatio, seatsLabel, tripBadge } from '@/lib/trips';

/** La home dello staff: chi è in viaggio adesso, chi parte presto, cosa manca. */
export function OverviewPage() {
  const { data: admin } = useAdminSession();
  const overview = useOverview();
  const ongoing = useTrips({ status: 'ongoing', page: 0 });
  const today = todayISO();

  return (
    <>
      <PageHeader
        title={`Ciao ${admin?.firstName || 'staff'} 👋`}
        subtitle={`Il polso dei viaggi, oggi ${longDate(today)} 🌍`}
      />
      <PageBody>
        {overview.isError ? (
          <QueryError error={overview.error} onRetry={() => void overview.refetch()} />
        ) : !overview.data ? (
          <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-[132px] rounded-card" />
            ))}
          </div>
        ) : (
          <Kpis overview={overview.data} />
        )}

        <section className="flex flex-col gap-3.5" aria-labelledby="live">
          <SectionLabel
            accent
            hint={overview.data ? `📸 ${overview.data.memoriesThisWeek} ricordi questa settimana` : null}
          >
            <span id="live">In viaggio adesso</span>
          </SectionLabel>
          {ongoing.isError ? (
            <QueryError error={ongoing.error} onRetry={() => void ongoing.refetch()} />
          ) : !ongoing.data ? (
            <Skeleton className="h-[220px] rounded-hero" />
          ) : ongoing.data.trips.length === 0 ? (
            <EmptyState
              emoji="🧳"
              title="Nessun viaggio in corso"
              hint="Quando una crew parte, il viaggio compare qui con il giorno a cui è arrivata."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {ongoing.data.trips.map((trip) => (
                <LiveCard key={trip.id} trip={trip} today={today} />
              ))}
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="flex flex-col gap-3.5" aria-labelledby="departures">
            <SectionLabel hint="prossimi 60 giorni">
              <span id="departures">Prossime partenze</span>
            </SectionLabel>
            {!overview.data ? (
              <TripRowSkeleton />
            ) : overview.data.departures.length === 0 ? (
              <EmptyState
                emoji="🗺️"
                title="Nessuna partenza in vista"
                hint="Nei prossimi 60 giorni non parte nessuno."
              />
            ) : (
              <Card className="divide-y divide-ink-700 overflow-hidden">
                {overview.data.departures.map((trip) => (
                  <DepartureRow key={trip.id} trip={trip} today={today} />
                ))}
              </Card>
            )}
          </section>

          <section className="flex flex-col gap-3.5" aria-labelledby="attention">
            <SectionLabel hint="in corso e futuri">
              <span id="attention">Da sistemare</span>
            </SectionLabel>
            {!overview.data ? (
              <Skeleton className="h-[180px] rounded-card" />
            ) : overview.data.attention.length === 0 ? (
              <EmptyState
                emoji="✅"
                title="Tutto in ordine"
                hint="Ogni viaggio aperto ha alloggi, assicurazione e documenti."
              />
            ) : (
              <div className="flex flex-col gap-2.5">
                {overview.data.attention.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/viaggi/${trip.id}`}
                    className="flex flex-col gap-2.5 rounded-card border border-ink-700 bg-ink-900 p-4 transition-colors hover:bg-ink-850"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-[15px] font-extrabold tracking-tight text-white">
                        {trip.title}
                      </p>
                      <span className="shrink-0 text-[12px] font-bold text-mist">
                        {shortDate(trip.startDate)}
                      </span>
                    </div>
                    <ReadinessChips trip={trip} limit={3} />
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </PageBody>
    </>
  );
}

function Kpis({ overview }: { overview: NonNullable<ReturnType<typeof useOverview>['data']> }) {
  const { seats } = overview;
  const ratio = seats.capacity > 0 ? seats.taken / seats.capacity : null;
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <StatTile
        accent
        label="Viaggi in corso"
        value={overview.trips.ongoing}
        icon={<Plane size={18} strokeWidth={2.2} />}
        hint={`${overview.trips.upcoming} in programma · ${overview.trips.past} conclusi`}
      />
      <StatTile
        label="Prossime partenze"
        value={overview.departures.length}
        icon={<CalendarClock size={18} strokeWidth={2.2} />}
        hint="nei prossimi 60 giorni"
      />
      <StatTile
        label="Posti occupati"
        value={ratio === null ? '—' : `${Math.round(ratio * 100)}%`}
        hint={
          ratio === null ? (
            'nessun viaggio con capienza'
          ) : (
            <span className="flex flex-col gap-2">
              {seats.taken} su {seats.capacity} nei viaggi aperti
              <Meter ratio={ratio} label="Posti occupati nei viaggi aperti" />
            </span>
          )
        }
      />
      <StatTile
        label="Persone in viaggio"
        value={overview.activeTravellers}
        icon={<Users size={18} strokeWidth={2.2} />}
        hint={`${overview.people.total} account · ${overview.people.withoutTrips} senza viaggi`}
      />
    </div>
  );
}

/** La card grande del viaggio in corso, come la Hero dell'app. */
function LiveCard({ trip, today }: { trip: AdminTripSummary; today: string }) {
  return (
    <Link
      to={`/viaggi/${trip.id}`}
      aria-label={`Apri il viaggio ${trip.title}`}
      className="group overflow-hidden rounded-hero border border-ink-700 bg-ink-900 shadow-card"
    >
      <div className="relative flex h-[150px] flex-col justify-between bg-[radial-gradient(120%_120%_at_0%_0%,rgba(197,22,29,0.42),rgba(13,13,17,0.2)_55%,#0D0D11)] p-4">
        <Badge label={tripBadge(trip, today)} tone="live" pulse />
        <div>
          <p className="truncate text-[24px] leading-[30px] font-extrabold tracking-tight text-white">
            {trip.title}
          </p>
          <p className="truncate text-[13px] font-semibold text-white/65">
            {coordinatorsLabel(trip)} • Coordinatore · {trip.members} in viaggio
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <ReadinessChips trip={trip} limit={2} />
        <span className="flex h-12 items-center justify-center gap-2 rounded-control bg-tangerine text-[15px] font-extrabold tracking-tight text-white transition-transform group-hover:scale-[1.01]">
          Apri il viaggio
          <ArrowRight size={17} strokeWidth={2.6} />
        </span>
      </div>
    </Link>
  );
}

function DepartureRow({ trip, today }: { trip: AdminTripSummary; today: string }) {
  const ratio = fillRatio(trip);
  const [day, month] = shortDate(trip.startDate).split(' ');
  return (
    <Link
      to={`/viaggi/${trip.id}`}
      className="flex items-center gap-4 p-4 transition-colors hover:bg-ink-850"
    >
      <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[16px] border border-ink-700 bg-ink-850 leading-none">
        <span className="text-[20px] font-extrabold text-white">{day}</span>
        <span className="mt-1 text-[11px] font-bold tracking-wide text-tangerine-soft uppercase">
          {month}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-extrabold tracking-tight text-white">{trip.title}</span>
        </span>
        <span className="truncate text-[12.5px] font-semibold text-bone/55">
          {tripBadge(trip, today)} · {dateRange(trip.startDate, trip.endDate)}
        </span>
        {ratio !== null ? (
          <Meter ratio={ratio} label={`Posti: ${seatsLabel(trip)}`} className="max-w-[260px]" />
        ) : null}
      </span>
      <span className="hidden shrink-0 text-right text-[12.5px] font-bold text-bone sm:block">
        {seatsLabel(trip)}
        <span className="mt-1 block">
          <ReadinessChips trip={trip} limit={1} />
        </span>
      </span>
    </Link>
  );
}
