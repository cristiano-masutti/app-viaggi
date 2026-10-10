import { ArrowLeft, Copy, Link2, Pencil, RefreshCw, Settings, UserPlus, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { Link, useParams } from 'react-router';

import { errorMessage } from '@/api/client';
import { useDeleteInvitation, useOpenDocument, useRegenerateInviteCode, useTripPlan } from '@/api/plan';
import { useTrip } from '@/api/queries';
import type {
  AdminMember,
  AdminTripDetail,
  PlanActivity,
  PlanDay,
  TripDocument,
  TripPlan,
} from '@/api/types';
import { AddMemberDialog, InvitationsDialog, MemberDialog } from '@/components/crew/CrewDialogs';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { DocumentChip } from '@/components/plan/DocumentField';
import {
  ActivityDialog,
  CustomsDialog,
  EmergenciesDialog,
  InsuranceDialog,
  StayDialog,
  TransportDialog,
} from '@/components/plan/PlanDialogs';
import { TripSettingsDialog } from '@/components/plan/TripSettingsDialog';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, SectionLabel } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DashedAction } from '@/components/ui/DashedAction';
import { EmptyState } from '@/components/ui/EmptyState';
import { Meter } from '@/components/ui/Meter';
import { QueryError } from '@/components/ui/QueryError';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { type Status, StatusChip } from '@/components/ui/StatusChip';
import { useToast } from '@/components/ui/Toast';
import { dateRange, dayOf, daysBetween, shortDate, todayISO } from '@/lib/dates';
import { fullName, ROLE_LABELS } from '@/lib/people';
import { fillRatio, inviteLink, seatsLabel, tripBadge } from '@/lib/trips';

type Tab = 'organize' | 'crew';
const TABS = [
  { key: 'organize' as const, label: '📋 Organizza' },
  { key: 'crew' as const, label: '👥 Crew' },
];

/** Il foglio aperto in questo momento: uno alla volta, come nell'app. */
type Sheet =
  | { kind: 'stay'; day: PlanDay }
  | { kind: 'activity'; day: PlanDay; activity: PlanActivity | null }
  | { kind: 'insurance' }
  | { kind: 'customs' }
  | { kind: 'transport'; transportId: string | null }
  | { kind: 'emergencies' }
  | { kind: 'settings' }
  | { kind: 'addMember' }
  | { kind: 'member'; member: AdminMember }
  | { kind: 'invitations' };

/**
 * Il viaggio, per lo staff: tutto ciò che il coordinatore organizza dall'app
 * (programma, documenti, logistica, crew) più la checklist di partenza.
 */
export function TripDetailPage() {
  const { tripId = '' } = useParams();
  const trip = useTrip(tripId);
  const plan = useTripPlan(tripId);
  const [tab, setTab] = useState<Tab>('organize');
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const today = todayISO();
  const close = () => setSheet(null);

  if (trip.isError) {
    return (
      <>
        <PageHeader title="Viaggio" leading={<BackButton />} />
        <PageBody>
          <QueryError error={trip.error} onRetry={() => void trip.refetch()} />
        </PageBody>
      </>
    );
  }

  if (!trip.data) return <TripDetailSkeleton />;
  const detail = trip.data;

  return (
    <>
      <PageHeader
        leading={<BackButton />}
        title={detail.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge
              label={tripBadge(detail, today)}
              tone={
                detail.status === 'ongoing' ? 'live' : detail.status === 'upcoming' ? 'accent' : 'neutral'
              }
              pulse={detail.status === 'ongoing'}
            />
            <span>
              {dateRange(detail.startDate, detail.endDate)} · {detail.totalDays} giorni
              {detail.destination ? ` · ${detail.destination}` : ''}
            </span>
          </span>
        }
        actions={
          <Button
            variant="ghost"
            size="sm"
            icon={<Settings size={16} strokeWidth={2.2} />}
            onClick={() => setSheet({ kind: 'settings' })}
          >
            Impostazioni
          </Button>
        }
      >
        <Segmented
          label="Sezioni del viaggio"
          options={TABS}
          value={tab}
          onChange={setTab}
          className="max-w-[420px]"
        />
      </PageHeader>

      <PageBody>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="flex min-w-0 flex-col gap-8">
            {tab === 'organize' ? (
              plan.isError ? (
                <QueryError error={plan.error} onRetry={() => void plan.refetch()} />
              ) : !plan.data ? (
                <div className="flex flex-col gap-3.5">
                  <Skeleton className="h-[160px] rounded-card" />
                  <Skeleton className="h-[160px] rounded-card" />
                </div>
              ) : (
                <Organize plan={plan.data} today={today} onSheet={setSheet} />
              )
            ) : (
              <Crew trip={detail} onSheet={setSheet} />
            )}
          </div>
          <aside className="flex flex-col gap-5">
            <ReadinessCard trip={detail} />
            <InviteCard trip={detail} />
            <MemoriesCard trip={detail} />
          </aside>
        </div>
      </PageBody>

      {sheet?.kind === 'stay' ? <StayDialog tripId={tripId} day={sheet.day} onClose={close} /> : null}
      {sheet?.kind === 'activity' ? (
        <ActivityDialog tripId={tripId} day={sheet.day} activity={sheet.activity} onClose={close} />
      ) : null}
      {sheet?.kind === 'insurance' && plan.data ? (
        <InsuranceDialog tripId={tripId} insurance={plan.data.documents.insurance} onClose={close} />
      ) : null}
      {sheet?.kind === 'customs' && plan.data ? (
        <CustomsDialog tripId={tripId} customs={plan.data.documents.customs} onClose={close} />
      ) : null}
      {sheet?.kind === 'transport' && plan.data ? (
        <TransportDialog
          tripId={tripId}
          transport={plan.data.documents.transports.find((item) => item.id === sheet.transportId) ?? null}
          onClose={close}
        />
      ) : null}
      {sheet?.kind === 'emergencies' && plan.data ? (
        <EmergenciesDialog tripId={tripId} contacts={plan.data.emergencies} onClose={close} />
      ) : null}
      {sheet?.kind === 'settings' ? <TripSettingsDialog trip={detail} onClose={close} /> : null}
      {sheet?.kind === 'addMember' ? (
        <AddMemberDialog
          tripId={tripId}
          memberIds={detail.crew.map((member) => member.userId)}
          onClose={close}
        />
      ) : null}
      {sheet?.kind === 'member' ? (
        <MemberDialog tripId={tripId} member={sheet.member} onClose={close} />
      ) : null}
      {sheet?.kind === 'invitations' ? <InvitationsDialog tripId={tripId} onClose={close} /> : null}
    </>
  );
}

function BackButton() {
  return (
    <Link
      to="/viaggi"
      aria-label="Torna ai viaggi"
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-ink-700 bg-ink-900 text-bone hover:bg-ink-800"
    >
      <ArrowLeft size={19} strokeWidth={2.2} />
    </Link>
  );
}

function TripDetailSkeleton() {
  return (
    <>
      <PageHeader leading={<BackButton />} title={<Skeleton className="h-8 w-72 rounded-lg" />} />
      <PageBody>
        <div className="grid gap-8 lg:grid-cols-[1fr_330px]">
          <div className="flex flex-col gap-3.5">
            <Skeleton className="h-[52px] w-[420px] max-w-full rounded-control" />
            <Skeleton className="h-[160px] rounded-card" />
            <Skeleton className="h-[160px] rounded-card" />
          </div>
          <Skeleton className="h-[260px] rounded-card" />
        </div>
      </PageBody>
    </>
  );
}

/* ── Organizza ───────────────────────────────────────────────────────── */

function useDocumentOpener(tripId: string) {
  const open = useOpenDocument(tripId);
  const toast = useToast();
  return (document: TripDocument) => {
    open(document.id).catch((error: unknown) =>
      toast.show(errorMessage(error, 'Il documento non si apre.'), 'error'),
    );
  };
}

function Organize({
  plan,
  today,
  onSheet,
}: {
  plan: TripPlan;
  today: string;
  onSheet: (sheet: Sheet) => void;
}) {
  const openDocument = useDocumentOpener(plan.id);
  const currentDay = daysBetween(plan.startDate, today) + 1;
  const nightsWithoutStay = plan.days.filter((day) => day.index < plan.totalDays && !day.stay).length;
  const { insurance, customs, transports } = plan.documents;

  return (
    <>
      <section className="flex flex-col gap-3.5" aria-labelledby="programme">
        <SectionLabel
          accent
          hint={
            nightsWithoutStay > 0 ? `${nightsWithoutStay} notti senza alloggio` : 'ogni notte ha un tetto'
          }
        >
          <span id="programme">Programma</span>
        </SectionLabel>
        {plan.days.map((day) => (
          <DayCard
            key={day.index}
            day={day}
            last={day.index === plan.totalDays}
            today={day.index === currentDay}
            onSheet={onSheet}
            onOpen={openDocument}
          />
        ))}
      </section>

      <section className="flex flex-col gap-3.5" aria-labelledby="trip-docs">
        <SectionLabel hint="Validi per tutte le tappe">
          <span id="trip-docs">Documenti del viaggio</span>
        </SectionLabel>
        <div className="grid gap-3.5 md:grid-cols-2">
          <SlotCard
            emoji="🛡️"
            title="Assicurazione"
            onEdit={insurance ? () => onSheet({ kind: 'insurance' }) : undefined}
          >
            {insurance ? (
              <div className="flex flex-col gap-2.5">
                <p className="text-[14px] font-extrabold text-bone">
                  {insurance.company} · <span className="text-mist">{insurance.policy}</span>
                </p>
                {insurance.coverage ? (
                  <p className="text-[12.5px] font-semibold text-mist">{insurance.coverage}</p>
                ) : null}
                {insurance.emergencyPhone ? (
                  <a
                    href={`tel:${insurance.emergencyPhone}`}
                    className="text-[12.5px] font-bold text-tangerine-soft"
                  >
                    Centrale h24 {insurance.emergencyPhone}
                  </a>
                ) : null}
                {insurance.doc ? (
                  <DocumentChip
                    document={insurance.doc}
                    label="Polizza"
                    onOpen={() => openDocument(insurance.doc!)}
                  />
                ) : null}
              </div>
            ) : (
              <DashedAction
                emoji="🛡️"
                label="Aggiungi la polizza"
                onClick={() => onSheet({ kind: 'insurance' })}
                tone="warning"
              />
            )}
          </SlotCard>

          <SlotCard
            emoji="📄"
            title="Dogana / QR"
            onEdit={customs ? () => onSheet({ kind: 'customs' }) : undefined}
          >
            {customs ? (
              <div className="flex flex-col gap-2.5">
                <p className="font-mono text-[14px] font-bold text-cream">{customs.code}</p>
                {customs.note ? (
                  <p className="text-[12.5px] font-semibold text-mist">{customs.note}</p>
                ) : null}
                {customs.doc ? (
                  <DocumentChip
                    document={customs.doc}
                    label="Ricevuta"
                    onOpen={() => openDocument(customs.doc!)}
                  />
                ) : null}
              </div>
            ) : (
              <DashedAction
                emoji="📄"
                label="Aggiungi modulo doganale / QR"
                onClick={() => onSheet({ kind: 'customs' })}
              />
            )}
          </SlotCard>

          <SlotCard emoji="🚐" title="Mezzi">
            <div className="flex flex-col gap-2.5">
              {transports.map((transport) => (
                <div
                  key={transport.id}
                  className="flex flex-col gap-2 rounded-[16px] border border-ink-700 bg-ink-850 p-3"
                >
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-extrabold text-bone">
                        {transport.mode === 'flight' ? '✈️' : transport.mode === 'ferry' ? '⛴️' : '🚐'}{' '}
                        {transport.name}
                      </span>
                      {transport.reference ? (
                        <span className="block truncate text-[12.5px] font-semibold text-mist">
                          {transport.reference}
                        </span>
                      ) : null}
                    </span>
                    <EditButton
                      label={`Modifica ${transport.name}`}
                      onClick={() => onSheet({ kind: 'transport', transportId: transport.id })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {transport.docs.map((entry) =>
                      entry.doc ? (
                        <DocumentChip
                          key={entry.id}
                          document={entry.doc}
                          label={entry.label}
                          onOpen={() => openDocument(entry.doc!)}
                        />
                      ) : (
                        <span
                          key={entry.id}
                          className="rounded-[12px] border border-dashed border-ink-700 px-3 py-2 text-[12px] font-bold text-mist"
                        >
                          {entry.label} · senza file
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ))}
              <DashedAction
                emoji="🚐"
                label="Aggiungi noleggio, volo o traghetto"
                onClick={() => onSheet({ kind: 'transport', transportId: null })}
                tone={transports.length === 0 ? 'warning' : 'accent'}
              />
            </div>
          </SlotCard>

          <SlotCard
            emoji="🆘"
            title="Contatti SOS"
            onEdit={plan.emergencies.length ? () => onSheet({ kind: 'emergencies' }) : undefined}
          >
            {plan.emergencies.length ? (
              <ul className="flex flex-col gap-2">
                {plan.emergencies.map((contact) => (
                  <li key={contact.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-extrabold text-bone">
                        {contact.title}
                      </span>
                      {contact.subtitle ? (
                        <span className="block truncate text-[12px] font-semibold text-mist">
                          {contact.subtitle}
                        </span>
                      ) : null}
                    </span>
                    <a
                      href={`tel:${contact.phone}`}
                      className="shrink-0 text-[12.5px] font-bold text-tangerine-soft"
                    >
                      {contact.phone}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <DashedAction
                emoji="🆘"
                label="Aggiungi i contatti di emergenza"
                onClick={() => onSheet({ kind: 'emergencies' })}
                tone="warning"
              />
            )}
          </SlotCard>
        </div>
      </section>
    </>
  );
}

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] border border-ink-700 bg-ink-900 text-bone/80 hover:bg-ink-800 hover:text-bone"
    >
      <Pencil size={14} strokeWidth={2.2} />
    </button>
  );
}

function SlotCard({
  emoji,
  title,
  onEdit,
  children,
}: {
  emoji: string;
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-ink-850 text-[17px]"
        >
          {emoji}
        </span>
        <h3 className="flex-1 text-[15px] font-extrabold tracking-tight text-white">{title}</h3>
        {onEdit ? <EditButton label={`Modifica ${title.toLowerCase()}`} onClick={onEdit} /> : null}
      </div>
      {children}
    </Card>
  );
}

function DayCard({
  day,
  last,
  today,
  onSheet,
  onOpen,
}: {
  day: PlanDay;
  last: boolean;
  today: boolean;
  onSheet: (sheet: Sheet) => void;
  onOpen: (document: TripDocument) => void;
}) {
  return (
    <Card className={cn('flex flex-col gap-3 p-4', today && 'border-tangerine/50')}>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'rounded-chip px-3 py-1 text-[12.5px] font-extrabold',
            today ? 'bg-tangerine text-white' : 'border border-ink-700 bg-ink-850 text-bone',
          )}
        >
          G{day.index}
          {today ? ' · Oggi' : ''}
        </span>
        <span className="text-[13px] font-bold text-mist">{shortDate(day.date)}</span>
        {last ? <span className="ml-auto text-[12px] font-bold text-bone/40">Giorno del rientro</span> : null}
      </div>

      {day.stay ? (
        <div className="flex flex-col gap-2.5 rounded-[16px] border border-ink-700 bg-ink-850 p-3">
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="text-[18px]">
              🏨
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-extrabold text-bone">{day.stay.name}</span>
              <span className="block truncate text-[12.5px] font-semibold text-mist">{day.stay.address}</span>
            </span>
            <EditButton
              label={`Modifica l'alloggio del giorno ${day.index}`}
              onClick={() => onSheet({ kind: 'stay', day })}
            />
          </div>
          {day.stay.doc ? (
            <DocumentChip
              document={day.stay.doc}
              label="Prenotazione"
              onOpen={() => onOpen(day.stay!.doc!)}
            />
          ) : null}
        </div>
      ) : !last ? (
        <DashedAction
          emoji="🏨"
          label={`Aggiungi alloggio per il Giorno ${day.index}`}
          tone="warning"
          onClick={() => onSheet({ kind: 'stay', day })}
        />
      ) : null}

      {day.activities.map((activity) => (
        <div
          key={activity.id}
          className="flex flex-col gap-2 rounded-[16px] border border-ink-700 bg-ink-850 p-3"
        >
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="text-[18px]">
              🎟️
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-extrabold text-bone">{activity.name}</span>
              <span className="block truncate text-[12.5px] font-semibold text-mist">{activity.place}</span>
            </span>
            <EditButton
              label={`Modifica ${activity.name}`}
              onClick={() => onSheet({ kind: 'activity', day, activity })}
            />
          </div>
          {activity.doc ? (
            <DocumentChip document={activity.doc} label="Biglietto" onOpen={() => onOpen(activity.doc!)} />
          ) : null}
        </div>
      ))}

      <DashedAction
        label="Aggiungi attività o biglietto"
        onClick={() => onSheet({ kind: 'activity', day, activity: null })}
      />
    </Card>
  );
}

/* ── Crew ────────────────────────────────────────────────────────────── */

function Crew({ trip, onSheet }: { trip: AdminTripDetail; onSheet: (sheet: Sheet) => void }) {
  const ratio = fillRatio(trip);
  const deleteInvitation = useDeleteInvitation(trip.id);
  const toast = useToast();
  const [cancelling, setCancelling] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      <section className="flex flex-col gap-3.5" aria-labelledby="crew">
        <SectionLabel accent hint={seatsLabel(trip)}>
          <span id="crew">Crew</span>
        </SectionLabel>
        <Card className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center gap-3">
            {ratio !== null ? (
              <Meter
                ratio={ratio}
                label={`Posti occupati: ${seatsLabel(trip)}`}
                className="min-w-[160px] flex-1"
              />
            ) : (
              <span className="flex-1" />
            )}
            <Button
              size="sm"
              icon={<UserPlus size={15} strokeWidth={2.4} />}
              onClick={() => onSheet({ kind: 'addMember' })}
            >
              Aggiungi persona
            </Button>
          </div>
          <ul className="flex flex-col divide-y divide-ink-700">
            {trip.crew.map((member) => (
              <li key={member.userId} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar person={member} coordinator={member.role === 'coordinator'} />
                <span className="min-w-0 flex-1">
                  <Link
                    to={`/persone/${member.userId}`}
                    className="block truncate text-[14.5px] font-extrabold text-bone hover:underline"
                  >
                    {fullName(member)}
                  </Link>
                  <span className="block truncate text-[12.5px] font-semibold text-mist">
                    {ROLE_LABELS[member.role]} · {member.email ?? 'senza email'}
                  </span>
                </span>
                <span className="hidden sm:block">
                  <PassportChip passport={member.passport} />
                </span>
                <Button variant="ghost" size="sm" onClick={() => onSheet({ kind: 'member', member })}>
                  Gestisci
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section className="flex flex-col gap-3.5" aria-labelledby="reserved">
        <SectionLabel hint="si chiudono quando la persona entra">
          <span id="reserved">Posti riservati</span>
        </SectionLabel>
        {trip.invitations.length === 0 ? (
          <EmptyState
            emoji="🎟️"
            title="Nessun posto riservato"
            hint="Tieni un posto per chi non ha ancora l'app: con l'email, entrando dal link lo occupa da solo."
            action={
              <Button variant="ghost" size="sm" onClick={() => onSheet({ kind: 'invitations' })}>
                Riserva posti
              </Button>
            }
          />
        ) : (
          <Card className="flex flex-col gap-3 p-4">
            <ul className="flex flex-col divide-y divide-ink-700">
              {trip.invitations.map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold text-bone">
                      {invitation.name}
                    </span>
                    <span className="block truncate text-[12.5px] font-semibold text-mist">
                      {invitation.email ?? 'senza email'} · dal {dayOf(invitation.createdAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Libera il posto di ${invitation.name}`}
                    onClick={() => setCancelling({ id: invitation.id, name: invitation.name })}
                    className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-ink-700 text-bone/60 hover:text-danger"
                  >
                    <X size={15} strokeWidth={2.2} />
                  </button>
                </li>
              ))}
            </ul>
            <Button variant="ghost" size="sm" onClick={() => onSheet({ kind: 'invitations' })}>
              Riserva altri posti
            </Button>
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={!!cancelling}
        title={`Liberare il posto di ${cancelling?.name ?? ''}?`}
        message="Il posto torna disponibile per chiunque entri con il link."
        confirmLabel="Libera"
        loading={deleteInvitation.isPending}
        onClose={() => setCancelling(null)}
        onConfirm={() =>
          cancelling &&
          deleteInvitation.mutate(cancelling.id, {
            onSuccess: () => {
              toast.show('Posto liberato');
              setCancelling(null);
            },
            onError: (error) => toast.show(errorMessage(error), 'error'),
          })
        }
      />
    </>
  );
}

function PassportChip({ passport }: { passport: AdminMember['passport'] }) {
  if (!passport.present) return <StatusChip status="bad" label="Passaporto mancante" />;
  return (
    <StatusChip status="ok" label={passport.expiry ? `Passaporto · ${passport.expiry}` : 'Passaporto'} />
  );
}

/* ── Colonna laterale ────────────────────────────────────────────────── */

function ReadinessCard({ trip }: { trip: AdminTripDetail }) {
  const { readiness } = trip;
  const rows: Array<{ label: string; detail: string; status: Status }> = [
    {
      label: 'Alloggi',
      detail:
        readiness.stays.needed === 0
          ? 'nessuna notte'
          : `${readiness.stays.covered} notti su ${readiness.stays.needed}`,
      status: readiness.stays.covered >= readiness.stays.needed ? 'ok' : 'bad',
    },
    {
      label: 'Assicurazione',
      detail: readiness.insurance ? 'presente' : 'manca',
      status: readiness.insurance ? 'ok' : 'bad',
    },
    {
      label: 'Mezzi',
      detail: readiness.transport ? 'presenti' : 'nessuno',
      status: readiness.transport ? 'ok' : 'bad',
    },
    {
      label: 'Contatti SOS',
      detail: readiness.emergencyContacts ? 'presenti' : 'nessuno',
      status: readiness.emergencyContacts ? 'ok' : 'bad',
    },
    {
      label: 'Passaporti',
      detail:
        readiness.passports.expiring > 0
          ? `${readiness.passports.ready}/${readiness.passports.total} · ${readiness.passports.expiring} in scadenza`
          : `${readiness.passports.ready} su ${readiness.passports.total}`,
      status:
        readiness.passports.ready < readiness.passports.total
          ? 'bad'
          : readiness.passports.expiring > 0
            ? 'warn'
            : 'ok',
    },
  ];
  const done = readiness.issues.length === 0;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold tracking-tight text-white">Pronto a partire?</h2>
        {trip.status !== 'past' ? (
          <StatusChip
            status={done ? 'ok' : 'bad'}
            label={done ? 'Sì' : `${readiness.issues.length} da sistemare`}
          />
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="font-bold text-bone">{row.label}</span>
            <StatusChip status={row.status} label={row.detail} />
          </li>
        ))}
      </ul>
      <p className="text-[12px] font-semibold text-mist">
        Passaporti validi almeno 6 mesi dopo il rientro. Il numero resta nel profilo di ognuno.
      </p>
    </Card>
  );
}

function InviteCard({ trip }: { trip: AdminTripDetail }) {
  const toast = useToast();
  const regenerate = useRegenerateInviteCode(trip.id);
  const [confirming, setConfirming] = useState(false);
  const link = inviteLink(trip.inviteCode);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight text-white">
        <Link2 size={16} strokeWidth={2.2} className="text-tangerine-soft" /> Link di invito
      </h2>
      <code className="rounded-[12px] border border-ink-700 bg-ink-950 px-3 py-2.5 font-mono text-[12.5px] break-all text-cream">
        {link}
      </code>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="ghost"
          size="sm"
          icon={<Copy size={14} strokeWidth={2.2} />}
          onClick={() =>
            void navigator.clipboard
              .writeText(`https://${link}`)
              .then(() => toast.show('Link copiato'))
              .catch(() => toast.show('Copia non riuscita', 'error'))
          }
        >
          Copia
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw size={14} strokeWidth={2.2} />}
          onClick={() => setConfirming(true)}
        >
          Nuovo link
        </Button>
      </div>
      <ConfirmDialog
        open={confirming}
        title="Creare un nuovo link?"
        message="Il link attuale smette subito di funzionare: chi lo ha già ricevuto non potrà più entrare con quello."
        confirmLabel="Nuovo link"
        loading={regenerate.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          regenerate.mutate(undefined, {
            onSuccess: () => {
              toast.show('Nuovo link pronto');
              setConfirming(false);
            },
            onError: (error) => toast.show(errorMessage(error), 'error'),
          })
        }
      />
    </Card>
  );
}

function MemoriesCard({ trip }: { trip: AdminTripDetail }) {
  const { photos, videos, notes } = trip.memories;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-[15px] font-extrabold tracking-tight text-white">Ricordi</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { emoji: '📸', value: photos, label: 'foto' },
          { emoji: '🎬', value: videos, label: 'video' },
          { emoji: '📝', value: notes, label: 'note' },
        ].map((item) => (
          <div key={item.label} className="rounded-[14px] border border-ink-700 bg-ink-850 px-2 py-2.5">
            <p className="text-[18px] font-extrabold text-bone">
              <span aria-hidden>{item.emoji}</span> {item.value}
            </p>
            <p className="text-[11.5px] font-bold text-mist">{item.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] font-semibold text-mist">Solo i numeri: foto e note restano della crew.</p>
    </Card>
  );
}
