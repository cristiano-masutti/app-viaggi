import type { AdminTripSummary } from '@/api/types';
import { StatusChip } from '@/components/ui/StatusChip';
import { issueLabel } from '@/lib/trips';

/** Cosa manca a un viaggio, una pillola per problema; "Pronto" se non manca niente. */
export function ReadinessChips({
  trip,
  limit,
}: {
  trip: Pick<AdminTripSummary, 'readiness' | 'status'>;
  limit?: number;
}) {
  // Un viaggio concluso non ha più niente da sistemare.
  if (trip.status === 'past') return null;
  const { issues } = trip.readiness;
  if (issues.length === 0) {
    return (
      <span className="flex">
        <StatusChip status="ok" label="Pronto" />
      </span>
    );
  }

  const shown = limit ? issues.slice(0, limit) : issues;
  const hidden = issues.length - shown.length;
  return (
    <span className="flex flex-wrap gap-1.5">
      {shown.map((issue) => (
        <StatusChip
          key={issue}
          status={issue === 'PASSPORTS_EXPIRING' ? 'warn' : 'bad'}
          label={issueLabel(issue, trip.readiness)}
        />
      ))}
      {hidden > 0 ? (
        <span className="inline-flex items-center rounded-chip border border-ink-700 px-2.5 py-1 text-[12px] font-bold text-mist">
          +{hidden}
        </span>
      ) : null}
    </span>
  );
}
