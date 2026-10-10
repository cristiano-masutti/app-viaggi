import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { errorMessage } from '@/api/client';
import { useCreateTrip } from '@/api/plan';
import { PAGE_SIZE, useTrips } from '@/api/queries';
import type { AdminUser, TripStatus } from '@/api/types';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { PersonPicker } from '@/components/people/PersonPicker';
import { TripRow, TripRowSkeleton } from '@/components/trips/TripRow';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, SearchField } from '@/components/ui/Field';
import { Pager } from '@/components/ui/Pager';
import { QueryError } from '@/components/ui/QueryError';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { todayISO } from '@/lib/dates';
import { pageFromParams, pageParam, withParams } from '@/lib/searchParams';
import { useDebounced } from '@/lib/useDebounced';

type Filter = TripStatus | 'all';

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: 'ongoing', label: 'In corso' },
  { key: 'upcoming', label: 'Futuri' },
  { key: 'past', label: 'Passati' },
  { key: 'all', label: 'Tutti' },
];

const SUBTITLES: Record<Filter, string> = {
  ongoing: 'Zaino in spalla, si esplora! 🌍',
  upcoming: 'Il conto alla rovescia è iniziato 🎒',
  past: 'Quanti ricordi insieme... ✨',
  all: "Tutti i viaggi dell'organizzazione 🗺️",
};

const EMPTY: Record<Filter, { title: string; hint: string }> = {
  ongoing: { title: 'Nessun viaggio in corso', hint: 'Quando una crew parte, il viaggio compare qui.' },
  upcoming: {
    title: 'Nessun viaggio in programma',
    hint: 'Creane uno: bastano titolo, date e un coordinatore.',
  },
  past: { title: 'Nessun viaggio concluso', hint: 'I viaggi finiti restano qui, con i loro numeri.' },
  all: { title: 'Ancora nessun viaggio', hint: 'Creane uno: bastano titolo, date e un coordinatore.' },
};

/**
 * Tutti i viaggi, con i segmenti dell'hub dell'app. Filtro, ricerca e pagina
 * stanno nell'indirizzo: un link porta esattamente alla stessa lista.
 */
export function TripsPage() {
  const [params, setParams] = useSearchParams();
  const filter: Filter = FILTERS.find((item) => item.key === params.get('stato'))?.key ?? 'upcoming';
  const page = pageFromParams(params);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounced(search.trim());
  const [creating, setCreating] = useState(false);
  const today = todayISO();

  const trips = useTrips({ status: filter === 'all' ? undefined : filter, q, page });

  const update = (next: { stato?: Filter; pagina?: number; q?: string }) =>
    setParams(withParams(params, { stato: next.stato, q: next.q, pagina: pageParam(next.pagina) }), {
      replace: true,
    });

  return (
    <>
      <PageHeader
        title="Viaggi"
        subtitle={SUBTITLES[filter]}
        actions={
          <Button icon={<Plus size={18} strokeWidth={2.6} />} onClick={() => setCreating(true)}>
            Nuovo viaggio
          </Button>
        }
      >
        <div className="flex flex-col gap-3 md:flex-row">
          <Segmented
            label="Stato dei viaggi"
            options={FILTERS}
            value={filter}
            onChange={(key) => update({ stato: key, pagina: 0 })}
            className="md:w-[460px]"
          />
          <SearchField
            aria-label="Cerca un viaggio"
            placeholder="Cerca per titolo o destinazione"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              update({ q: event.target.value.trim(), pagina: 0 });
            }}
            className="flex-1"
          />
        </div>
      </PageHeader>

      <PageBody>
        {trips.isError ? (
          <QueryError error={trips.error} onRetry={() => void trips.refetch()} />
        ) : !trips.data ? (
          <div className="flex flex-col gap-3">
            <TripRowSkeleton />
            <TripRowSkeleton />
            <TripRowSkeleton />
          </div>
        ) : trips.data.trips.length === 0 ? (
          q ? (
            <EmptyState emoji="🔎" title="Nessun viaggio trovato" hint={`Niente corrisponde a “${q}”.`} />
          ) : (
            <EmptyState
              emoji="🗺️"
              title={EMPTY[filter].title}
              hint={EMPTY[filter].hint}
              action={
                filter === 'upcoming' || filter === 'all' ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Plus size={16} strokeWidth={2.4} />}
                    onClick={() => setCreating(true)}
                  >
                    Pianifica un viaggio
                  </Button>
                ) : null
              }
            />
          )
        ) : (
          <div className={trips.isPlaceholderData ? 'flex flex-col gap-3 opacity-60' : 'flex flex-col gap-3'}>
            {trips.data.trips.map((trip) => (
              <TripRow key={trip.id} trip={trip} today={today} />
            ))}
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={trips.data.total}
              onPage={(next) => update({ pagina: next })}
            />
          </div>
        )}
      </PageBody>

      <CreateTripDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

/** Un viaggio nuovo: titolo, date, capienza e chi lo coordina. Il resto si organizza dentro. */
function CreateTripDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = useCreateTrip();
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [capacity, setCapacity] = useState('');
  const [coordinator, setCoordinator] = useState<AdminUser | null>(null);

  const datesInverted = !!startDate && !!endDate && endDate < startDate;
  const canSave = title.trim().length >= 2 && !!startDate && !!endDate && !datesInverted && !!coordinator;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave || !coordinator) return;
    create.mutate(
      {
        title: title.trim(),
        destination: destination.trim() || undefined,
        startDate,
        endDate,
        crewCapacity: capacity ? Number(capacity) : undefined,
        coordinatorUserId: coordinator.id,
      },
      {
        onSuccess: (trip) => {
          toast.show('Viaggio creato 🚀');
          onClose();
          void navigate(`/viaggi/${trip.id}`);
        },
        onError: (error) => toast.show(errorMessage(error), 'error'),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuovo viaggio"
      subtitle="Il programma e i documenti si aggiungono dopo, dentro al viaggio."
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field
          label="Titolo"
          placeholder="es. Islanda On The Road 🇮🇸"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
        />
        <Field
          label="Destinazione"
          placeholder="es. Islanda"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          maxLength={120}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Partenza"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />
          <Field
            label="Rientro"
            type="date"
            value={endDate}
            min={startDate || undefined}
            onChange={(event) => setEndDate(event.target.value)}
            error={datesInverted ? 'Il rientro è prima della partenza.' : null}
          />
        </div>
        <Field
          label="Posti (facoltativo)"
          type="number"
          inputMode="numeric"
          min={1}
          max={200}
          placeholder="es. 10"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
        />
        <PersonPicker selected={coordinator} onSelect={setCoordinator} />
        <Button type="submit" disabled={!canSave} loading={create.isPending} className="mt-2">
          Crea viaggio 🚀
        </Button>
      </form>
    </Dialog>
  );
}
