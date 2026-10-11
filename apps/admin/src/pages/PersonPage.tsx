import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { useUser } from '@/api/queries';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { LastSeen } from '@/components/people/LastSeen';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Card, SectionLabel } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryError';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { dateRange, dayOf, todayISO } from '@/lib/dates';
import { formatCount } from '@/lib/metrics';
import { fullName, ROLE_LABELS } from '@/lib/people';
import { tripBadge } from '@/lib/trips';

/** Una persona: i suoi viaggi e lo stato del passaporto. Il resto del profilo è suo. */
export function PersonPage() {
  const { userId = '' } = useParams();
  const user = useUser(userId);
  const today = todayISO();

  const back = (
    <Link
      to="/persone"
      aria-label="Torna alle persone"
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-ink-700 bg-ink-900 text-bone hover:bg-ink-800"
    >
      <ArrowLeft size={19} strokeWidth={2.2} />
    </Link>
  );

  if (user.isError) {
    return (
      <>
        <PageHeader title="Persona" leading={back} />
        <PageBody>
          <QueryError error={user.error} onRetry={() => void user.refetch()} />
        </PageBody>
      </>
    );
  }

  const person = user.data;
  return (
    <>
      <PageHeader
        leading={
          <span className="flex items-center gap-3">
            {back}
            {person ? <Avatar person={person} size={48} /> : <Skeleton className="h-12 w-12 rounded-full" />}
          </span>
        }
        title={person ? fullName(person) : <Skeleton className="h-8 w-56 rounded-lg" />}
        subtitle={
          person ? (
            <span className="flex flex-wrap items-center gap-2">
              {person.username ? <span>@{person.username} ·</span> : null}
              <span>{person.email ?? 'senza email'}</span>
              {person.isAdmin ? <Badge label="STAFF" tone="accent" /> : null}
            </span>
          ) : null
        }
      />
      <PageBody>
        {!person ? (
          <Skeleton className="h-[200px] rounded-card" />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
            <section className="flex flex-col gap-3.5" aria-labelledby="trips">
              <SectionLabel accent hint={`${person.trips.length} in tutto`}>
                <span id="trips">Viaggi</span>
              </SectionLabel>
              {person.trips.length === 0 ? (
                <EmptyState
                  emoji="🧳"
                  title="Non è ancora in nessun viaggio"
                  hint="Aprilo da Viaggi e usa “Aggiungi persona” nella crew."
                />
              ) : (
                <Card className="divide-y divide-ink-700 overflow-hidden">
                  {person.trips.map((trip) => (
                    <Link
                      key={trip.tripId}
                      to={`/viaggi/${trip.tripId}`}
                      className="flex flex-col gap-2 p-4 transition-colors hover:bg-ink-850 sm:flex-row sm:items-center"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-extrabold tracking-tight text-white">
                          {trip.title}
                        </span>
                        <span className="block truncate text-[12.5px] font-semibold text-mist">
                          {dateRange(trip.startDate, trip.endDate)} · {ROLE_LABELS[trip.role]}
                        </span>
                      </span>
                      <Badge
                        label={tripBadge(
                          { ...trip, totalDays: totalDays(trip.startDate, trip.endDate) },
                          today,
                        )}
                        tone={
                          trip.status === 'ongoing'
                            ? 'live'
                            : trip.status === 'upcoming'
                              ? 'accent'
                              : 'neutral'
                        }
                        pulse={trip.status === 'ongoing'}
                      />
                    </Link>
                  ))}
                </Card>
              )}
            </section>
            <aside className="flex flex-col gap-5">
              <Card className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-extrabold tracking-tight text-white">Nell'app</h2>
                  <LastSeen lastSeenAt={person.lastSeenAt} className="text-[12.5px]" />
                </div>
                <dl className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['Ingressi', person.usage.appOpens],
                      ['Schermate', person.usage.screenViews],
                      ['Documenti', person.usage.documentOpens],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-[16px] border border-ink-700 bg-ink-850 px-3 py-2.5">
                      <dt className="text-[11.5px] font-bold text-mist">{label}</dt>
                      <dd className="text-[20px] leading-tight font-extrabold text-bone">
                        {formatCount(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-[12px] font-semibold text-mist">
                  Negli ultimi 30 giorni. Si contano gli ingressi, mai cosa la persona guarda dentro.
                </p>
              </Card>
              <Card className="flex flex-col gap-3 p-4">
                <h2 className="text-[15px] font-extrabold tracking-tight text-white">Documenti</h2>
                <div className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="font-bold text-bone">Passaporto</span>
                  {person.passport.present ? (
                    <StatusChip
                      status="ok"
                      label={person.passport.expiry ? `scade ${person.passport.expiry}` : 'presente'}
                    />
                  ) : (
                    <StatusChip status="bad" label="manca" />
                  )}
                </div>
                <p className="text-[12px] font-semibold text-mist">
                  Numero, note mediche e codice fiscale restano nel profilo della persona: il pannello non li
                  mostra.
                </p>
              </Card>
              <Card className="flex flex-col gap-1.5 p-4 text-[13px] font-semibold text-mist">
                <span>
                  Account dal <span className="font-bold text-bone">{dayOf(person.createdAt)}</span>
                </span>
              </Card>
            </aside>
          </div>
        )}
      </PageBody>
    </>
  );
}

const totalDays = (start: string, end: string) =>
  Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1;
