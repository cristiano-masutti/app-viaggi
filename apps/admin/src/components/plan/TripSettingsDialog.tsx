import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { errorMessage } from '@/api/client';
import { useDeleteTrip, useUpdateTrip } from '@/api/plan';
import type { AdminTripDetail } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';

import { SlotForm } from './SlotForm';

/**
 * Titolo, destinazione, date e posti. Spostare le date sposta tutto il
 * programma; il backend rifiuta di accorciare un viaggio che ha ancora
 * contenuti nei giorni tolti, e una capienza sotto i posti già occupati.
 */
export function TripSettingsDialog({ trip, onClose }: { trip: AdminTripDetail; onClose: () => void }) {
  const update = useUpdateTrip(trip.id);
  const remove = useDeleteTrip(trip.id);
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination ?? '');
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [capacity, setCapacity] = useState(trip.crewCapacity === null ? '' : String(trip.crewCapacity));
  const [confirming, setConfirming] = useState(false);
  const inverted = endDate < startDate;

  return (
    <>
      <Dialog
        open={!confirming}
        onClose={onClose}
        title="Impostazioni del viaggio"
        subtitle="Il programma segue le date: G1 è sempre la partenza"
      >
        <SlotForm
          canSave={title.trim().length >= 2 && !!startDate && !!endDate && !inverted}
          saving={update.isPending}
          onSubmit={() =>
            update.mutate(
              {
                title: title.trim(),
                destination: destination.trim() || null,
                startDate,
                endDate,
                crewCapacity: capacity ? Number(capacity) : null,
              },
              {
                onSuccess: () => {
                  toast.show('Viaggio aggiornato');
                  onClose();
                },
                onError: (error) => toast.show(errorMessage(error), 'error'),
              },
            )
          }
        >
          <Field
            label="Titolo"
            value={title}
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
          />
          <Field
            label="Destinazione"
            value={destination}
            maxLength={120}
            onChange={(event) => setDestination(event.target.value)}
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
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              error={inverted ? 'Il rientro è prima della partenza.' : null}
            />
          </div>
          <Field
            label="Posti (vuoto = senza limite)"
            type="number"
            inputMode="numeric"
            min={1}
            max={200}
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
          />
        </SlotForm>
        <div className="mt-6 flex flex-col gap-2 border-t border-ink-700 pt-5">
          <p className="text-[12.5px] font-semibold text-mist">
            Eliminare il viaggio cancella per tutti programma, documenti e ricordi. Non si torna indietro.
          </p>
          <Button
            variant="danger"
            icon={<Trash2 size={15} strokeWidth={2} />}
            onClick={() => setConfirming(true)}
          >
            Elimina il viaggio
          </Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title={`Eliminare “${trip.title}”?`}
        message={`Spariscono per tutta la crew (${trip.members} persone) il programma, i documenti caricati e i ricordi. Non si può annullare.`}
        confirmLabel="Elimina per sempre"
        loading={remove.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(undefined, {
            onSuccess: () => {
              toast.show('Viaggio eliminato');
              void navigate('/viaggi', { replace: true });
            },
            onError: (error) => {
              setConfirming(false);
              toast.show(errorMessage(error), 'error');
            },
          })
        }
      />
    </>
  );
}
