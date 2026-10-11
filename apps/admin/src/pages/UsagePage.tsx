import { CalendarCheck, Smartphone, UserRoundSearch, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import { useUsage } from '@/api/queries';
import type { AdminUsage } from '@/api/types';
import { BarList } from '@/components/charts/BarList';
import { ChartCard, DataTable } from '@/components/charts/ChartCard';
import { TrendChart } from '@/components/charts/TrendChart';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { RangeFilter, useRange } from '@/components/metrics/RangeFilter';
import { Avatar } from '@/components/ui/Avatar';
import { Card, SectionLabel } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { Meter } from '@/components/ui/Meter';
import { QueryError } from '@/components/ui/QueryError';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import { daysBetween, shortDate, todayISO } from '@/lib/dates';
import {
  formatCount,
  INACTIVE_AFTER_DAYS,
  lastSeenLabel,
  lastSeenStatus,
  percentOf,
  PLATFORM_LABELS,
  screenLabel,
} from '@/lib/metrics';
import { fullName } from '@/lib/people';

type Series = 'activeUsers' | 'appOpens' | 'documentOpens';

/** `short` è il nome sul selettore: sul telefono "Persone attive" andrebbe a capo. */
const SERIES: ReadonlyArray<{ key: Series; label: string; short: string; description: string }> = [
  {
    key: 'activeUsers',
    label: 'Persone attive',
    short: 'Persone',
    description: "Chi ha aperto l'app almeno una volta nel giorno",
  },
  {
    key: 'appOpens',
    label: 'Aperture',
    short: 'Aperture',
    description: "Ogni ingresso nell'app, anche dallo sfondo",
  },
  {
    key: 'documentOpens',
    label: 'Documenti aperti',
    short: 'Documenti',
    description: 'Voucher, biglietti, assicurazioni consultati',
  },
];

/**
 * Come si usa l'app: quante persone entrano, cosa guardano, e soprattutto
 * chi è in viaggio (o sta per partire) e non l'ha mai aperta.
 */
export function UsagePage() {
  const [range, setRange] = useRange();
  const usage = useUsage({ days: range });

  return (
    <>
      <PageHeader title="Uso dell'app" subtitle="Chi entra, cosa guarda, chi manca all'appello 📱">
        <RangeFilter value={range} onChange={setRange} />
      </PageHeader>
      <PageBody>
        {usage.isError ? (
          <QueryError error={usage.error} onRetry={() => void usage.refetch()} />
        ) : !usage.data ? (
          <UsageSkeleton />
        ) : (
          <UsageContent usage={usage.data} refreshing={usage.isPlaceholderData} />
        )}
      </PageBody>
    </>
  );
}

function UsageContent({ usage, refreshing }: { usage: AdminUsage; refreshing: boolean }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatTile
          accent
          label="Attivi oggi"
          value={formatCount(usage.activeUsers.today)}
          icon={<Smartphone size={18} strokeWidth={2.2} />}
          hint={`su ${formatCount(usage.people)} persone con un account`}
        />
        <StatTile
          label="Attivi in 7 giorni"
          value={formatCount(usage.activeUsers.week)}
          icon={<CalendarCheck size={18} strokeWidth={2.2} />}
          hint={`${percentOf(usage.activeUsers.week, usage.people)} delle persone`}
        />
        <StatTile
          label="Attivi in 30 giorni"
          value={formatCount(usage.activeUsers.month)}
          icon={<Users size={18} strokeWidth={2.2} />}
          hint={
            usage.people > 0 ? (
              <span className="flex flex-col gap-2">
                {percentOf(usage.activeUsers.month, usage.people)} delle persone
                <Meter
                  ratio={usage.activeUsers.month / usage.people}
                  label="Persone attive negli ultimi 30 giorni"
                />
              </span>
            ) : (
              'nessun account ancora'
            )
          }
        />
        <StatTile
          label="Da cercare"
          value={formatCount(usage.inactive.total)}
          icon={<UserRoundSearch size={18} strokeWidth={2.2} />}
          hint={`in viaggio o in partenza, assenti da ${INACTIVE_AFTER_DAYS} giorni`}
        />
      </div>

      <DailyCard usage={usage} refreshing={refreshing} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="flex flex-col gap-3.5" aria-labelledby="inactive">
          <SectionLabel accent hint="prima chi non è mai entrato">
            <span id="inactive">Da cercare</span>
          </SectionLabel>
          <InactivePeople usage={usage} />
        </section>

        <section className="flex flex-col gap-3.5" aria-labelledby="live-crews">
          <SectionLabel hint="ultimi 7 giorni">
            <span id="live-crews">Crew in viaggio</span>
          </SectionLabel>
          <LiveCrews usage={usage} />
        </section>
      </div>

      <div
        className={cn('grid grid-cols-1 gap-8 transition-opacity md:grid-cols-2', refreshing && 'opacity-50')}
      >
        <section className="flex flex-col gap-3.5" aria-labelledby="screens">
          <SectionLabel hint={`ultimi ${daysInRange(usage)} giorni`}>
            <span id="screens">Schermate più viste</span>
          </SectionLabel>
          {usage.screens.length === 0 ? (
            <EmptyState emoji="📱" title="Nessuna visita nel periodo" />
          ) : (
            <Card className="p-4 sm:p-5">
              <BarList
                label="Visite per schermata"
                items={usage.screens.map((screen) => ({
                  key: screen.screen,
                  label: screenLabel(screen.screen),
                  detail: `${formatCount(screen.users)} ${screen.users === 1 ? 'persona' : 'persone'}`,
                  value: screen.views,
                  display: formatCount(screen.views),
                }))}
              />
            </Card>
          )}
        </section>

        <section className="flex flex-col gap-3.5" aria-labelledby="platforms">
          <SectionLabel hint="persone attive nel periodo">
            <span id="platforms">Dispositivi</span>
          </SectionLabel>
          {usage.platforms.length === 0 ? (
            <EmptyState emoji="📲" title="Nessuno ha usato l'app nel periodo" />
          ) : (
            <Card className="p-4 sm:p-5">
              <BarList
                label="Persone attive per dispositivo"
                items={usage.platforms.map((platform) => ({
                  key: platform.platform,
                  label: PLATFORM_LABELS[platform.platform],
                  value: platform.users,
                  display: formatCount(platform.users),
                }))}
              />
            </Card>
          )}
        </section>
      </div>

      <p className="text-[12px] font-semibold text-mist">
        Si contano ingressi, schermate e documenti aperti, mai cosa c'è dentro. Le misure si cancellano dopo
        180 giorni.
      </p>
    </>
  );
}

function DailyCard({ usage, refreshing }: { usage: AdminUsage; refreshing: boolean }) {
  const [series, setSeries] = useState<Series>('activeUsers');
  const current = SERIES.find((item) => item.key === series)!;
  const points = usage.daily.map((day) => ({
    key: day.day,
    label: shortDate(day.day),
    value: day[series],
  }));

  return (
    <ChartCard
      title="Giorno per giorno"
      description={current.description}
      controls={
        <Segmented
          label="Cosa mostrare"
          className="max-w-[460px]"
          options={SERIES.map(({ key, short }) => ({ key, label: short }))}
          value={series}
          onChange={setSeries}
        />
      }
      chart={
        <TrendChart points={points} seriesLabel={current.label} format={formatCount} dimmed={refreshing} />
      }
      table={
        <DataTable
          caption="Uso dell'app giorno per giorno"
          columns={['Giorno', ...SERIES.map((item) => item.label)]}
          rows={usage.daily.map((day) => ({
            key: day.day,
            cells: [
              shortDate(day.day),
              formatCount(day.activeUsers),
              formatCount(day.appOpens),
              formatCount(day.documentOpens),
            ],
          }))}
        />
      }
    />
  );
}

function InactivePeople({ usage }: { usage: AdminUsage }) {
  const today = todayISO();
  if (usage.inactive.total === 0)
    return (
      <EmptyState
        emoji="🙌"
        title="Tutti dentro"
        hint="Chi è in viaggio o sta per partire ha aperto l'app nelle ultime due settimane."
      />
    );
  const others = usage.inactive.total - usage.inactive.people.length;
  return (
    <Card className="divide-y divide-ink-700 overflow-hidden">
      {usage.inactive.people.map((person) => {
        const toDeparture = daysBetween(today, person.trip.startDate);
        return (
          <Link
            key={person.userId}
            to={`/persone/${person.userId}`}
            className="flex items-center gap-3 p-4 transition-colors hover:bg-ink-850"
          >
            <Avatar person={person} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-extrabold text-bone">
                {fullName(person)}
              </span>
              <span className="block truncate text-[12.5px] font-semibold text-mist">
                {person.trip.title} ·{' '}
                {toDeparture <= 0
                  ? 'in viaggio'
                  : toDeparture === 1
                    ? 'parte domani'
                    : `parte fra ${toDeparture} giorni`}
              </span>
              {/* Sul telefono il chip va sotto: accanto toglierebbe spazio al nome del viaggio. */}
              <span className="mt-1.5 block sm:hidden">
                <LastSeenChip lastSeenAt={person.lastSeenAt} />
              </span>
            </span>
            <span className="hidden shrink-0 sm:block">
              <LastSeenChip lastSeenAt={person.lastSeenAt} />
            </span>
          </Link>
        );
      })}
      {others > 0 ? (
        <p className="p-4 text-[12.5px] font-semibold text-mist">
          e altre {formatCount(others)} {others === 1 ? 'persona' : 'persone'}
        </p>
      ) : null}
    </Card>
  );
}

function LastSeenChip({ lastSeenAt }: { lastSeenAt: string | null }) {
  return (
    <StatusChip
      status={lastSeenStatus(lastSeenAt)}
      label={lastSeenAt ? `Visto ${lastSeenLabel(lastSeenAt)}` : 'Mai entrato'}
    />
  );
}

function LiveCrews({ usage }: { usage: AdminUsage }) {
  if (usage.liveTrips.length === 0)
    return (
      <EmptyState
        emoji="🧳"
        title="Nessun viaggio in corso"
        hint="Durante un viaggio qui si vede chi usa l'app."
      />
    );
  return (
    <div className="flex flex-col gap-2.5">
      {usage.liveTrips.map((trip) => (
        <Link
          key={trip.tripId}
          to={`/viaggi/${trip.tripId}`}
          className="flex flex-col gap-2.5 rounded-card border border-ink-700 bg-ink-900 p-4 transition-colors hover:bg-ink-850"
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[15px] font-extrabold tracking-tight text-white">{trip.title}</p>
            <span className="shrink-0 text-[12.5px] font-bold text-bone tabular-nums">
              {trip.activeMembers} su {trip.members}
            </span>
          </div>
          <Meter
            ratio={trip.members > 0 ? trip.activeMembers / trip.members : 0}
            label={`${trip.activeMembers} su ${trip.members} hanno usato l'app`}
          />
          <p className="text-[12.5px] font-semibold text-mist">
            {trip.activeMembers === trip.members
              ? 'Tutta la crew usa l’app'
              : `${trip.members - trip.activeMembers} ${trip.members - trip.activeMembers === 1 ? 'non l’ha aperta' : 'non l’hanno aperta'}`}{' '}
            · {formatCount(trip.documentOpens)}{' '}
            {trip.documentOpens === 1 ? 'documento aperto' : 'documenti aperti'}
          </p>
        </Link>
      ))}
    </div>
  );
}

const daysInRange = (usage: AdminUsage) => usage.daily.length;

function UsageSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[132px] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-[330px] rounded-card" />
    </>
  );
}
