import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';

import type { AdminTripSummary } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Meter } from '@/components/ui/Meter';
import { Skeleton } from '@/components/ui/Skeleton';
import { dateRange } from '@/lib/dates';
import { coordinatorsLabel, fillRatio, seatsLabel, tripBadge } from '@/lib/trips';

import { ReadinessChips } from './ReadinessChips';

/**
 * Un viaggio in una riga: pillola di stato come nell'app, date, chi coordina,
 * quanto è pieno e cosa manca. Tutta la riga è un solo bersaglio.
 */
export function TripRow({ trip, today }: { trip: AdminTripSummary; today: string }) {
  const ratio = fillRatio(trip);
  const tone = trip.status === 'ongoing' ? 'live' : trip.status === 'upcoming' ? 'accent' : 'neutral';

  return (
    <Link
      to={`/viaggi/${trip.id}`}
      aria-label={`Apri il viaggio ${trip.title}`}
      className="group grid gap-4 rounded-card border border-ink-700 bg-ink-900 p-4 transition-colors hover:border-ink-700 hover:bg-ink-850 sm:p-5 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] md:items-center"
    >
      <div className="flex min-w-0 flex-col gap-2">
        <Badge label={tripBadge(trip, today)} tone={tone} pulse={trip.status === 'ongoing'} />
        <p className="truncate text-[18px] font-extrabold tracking-tight text-white">{trip.title}</p>
        <p className="truncate text-[13px] font-semibold text-bone/55">
          {dateRange(trip.startDate, trip.endDate)} · {trip.totalDays} giorni · {coordinatorsLabel(trip)}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3 text-[13px] font-bold">
          <span className="text-bone">{seatsLabel(trip)}</span>
          {trip.pendingInvitations > 0 ? (
            <span className="text-mist">{trip.pendingInvitations} in attesa</span>
          ) : null}
        </div>
        {ratio !== null ? <Meter ratio={ratio} label={`Posti occupati: ${seatsLabel(trip)}`} /> : null}
        <ReadinessChips trip={trip} limit={2} />
      </div>

      <ChevronRight
        size={20}
        strokeWidth={2.2}
        className="hidden text-bone/30 transition-transform group-hover:translate-x-0.5 group-hover:text-bone/60 md:block"
        aria-hidden
      />
    </Link>
  );
}

export function TripRowSkeleton() {
  return (
    <div className="grid gap-4 rounded-card border border-ink-700 bg-ink-900 p-5 md:grid-cols-[1.6fr_1fr]">
      <div className="flex flex-col gap-2.5">
        <Skeleton className="h-[26px] w-40 rounded-chip" />
        <Skeleton className="h-5 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded-lg" />
      </div>
      <div className="flex flex-col justify-center gap-2.5">
        <Skeleton className="h-4 w-24 rounded-lg" />
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}
