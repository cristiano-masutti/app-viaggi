import { Plus, X } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/api/client';
import { type DocumentChange, KEEP } from '@/api/documents';
import {
  type EmergencyDraft,
  type TransportDocDraft,
  useDeleteActivity,
  useDeleteCustoms,
  useDeleteInsurance,
  useDeleteStay,
  useDeleteTransport,
  useSaveActivity,
  useSaveCustoms,
  useSaveEmergencies,
  useSaveInsurance,
  useSaveStay,
  useSaveTransport,
} from '@/api/plan';
import type {
  PlanActivity,
  PlanCustoms,
  PlanDay,
  PlanEmergency,
  PlanInsurance,
  PlanTransport,
  TransportMode,
} from '@/api/types';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { shortDate } from '@/lib/dates';

import { DocumentField } from './DocumentField';
import { SlotForm } from './SlotForm';

/**
 * I fogli di modifica del programma e della logistica: gli stessi campi della
 * EditSheet dell'app, gli stessi limiti del backend.
 */

interface Close {
  onClose: () => void;
}

/** Dopo un'azione: un toast e il foglio si chiude; se va male, il foglio resta aperto con il perché. */
function useFeedback(onClose: () => void) {
  const toast = useToast();
  return (success: string) => ({
    onSuccess: () => {
      toast.show(success);
      onClose();
    },
    onError: (error: unknown) => toast.show(errorMessage(error), 'error'),
  });
}

const dayTitle = (day: PlanDay) => `Giorno ${day.index} · ${shortDate(day.date)}`;

export function StayDialog({ tripId, day, onClose }: Close & { tripId: string; day: PlanDay }) {
  const save = useSaveStay(tripId);
  const remove = useDeleteStay(tripId);
  const feedback = useFeedback(onClose);
  const [name, setName] = useState(day.stay?.name ?? '');
  const [address, setAddress] = useState(day.stay?.address ?? '');
  const [document, setDocument] = useState<DocumentChange>(KEEP);

  return (
    <Dialog
      open
      onClose={onClose}
      title={day.stay ? "Modifica l'alloggio" : 'Alloggio del giorno'}
      subtitle={dayTitle(day)}
    >
      <SlotForm
        canSave={!!name.trim() && !!address.trim()}
        saving={save.isPending}
        onSubmit={() =>
          save.mutate(
            { day: day.index, name: name.trim(), address: address.trim(), document },
            feedback('Alloggio aggiornato'),
          )
        }
        onDelete={day.stay ? () => remove.mutate(day.index, feedback('Alloggio rimosso')) : undefined}
        deleteLabel="Rimuovi l'alloggio del giorno"
        deleting={remove.isPending}
      >
        <Field
          label="Nome struttura"
          placeholder="es. Hotel Kría, Vík"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          label="Indirizzo"
          placeholder="Via, numero, città"
          value={address}
          maxLength={120}
          onChange={(event) => setAddress(event.target.value)}
        />
        <DocumentField
          label="Voucher di prenotazione"
          current={day.stay?.doc}
          change={document}
          onChange={setDocument}
        />
      </SlotForm>
    </Dialog>
  );
}

export function ActivityDialog({
  tripId,
  day,
  activity,
  onClose,
}: Close & { tripId: string; day: PlanDay; activity: PlanActivity | null }) {
  const save = useSaveActivity(tripId);
  const remove = useDeleteActivity(tripId);
  const feedback = useFeedback(onClose);
  const [name, setName] = useState(activity?.name ?? '');
  const [place, setPlace] = useState(activity?.place ?? '');
  const [document, setDocument] = useState<DocumentChange>(KEEP);

  return (
    <Dialog
      open
      onClose={onClose}
      title={activity ? 'Modifica attività' : 'Nuova attività'}
      subtitle={`${dayTitle(day)} · ingresso, tour o cena`}
    >
      <SlotForm
        canSave={!!name.trim() && !!place.trim()}
        saving={save.isPending}
        onSubmit={() =>
          save.mutate(
            { activityId: activity?.id, day: day.index, name: name.trim(), place: place.trim(), document },
            feedback(activity ? 'Attività aggiornata' : 'Attività aggiunta'),
          )
        }
        onDelete={activity ? () => remove.mutate(activity.id, feedback('Attività eliminata')) : undefined}
        deleteLabel="Elimina l'attività"
        deleting={remove.isPending}
      >
        <Field
          label="Nome attività"
          placeholder="es. Trekking sul ghiacciaio"
          value={name}
          maxLength={70}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          label="Luogo"
          placeholder="Punto di ritrovo o indirizzo"
          value={place}
          maxLength={120}
          onChange={(event) => setPlace(event.target.value)}
        />
        <DocumentField
          label="Biglietto o voucher"
          current={activity?.doc}
          change={document}
          onChange={setDocument}
        />
      </SlotForm>
    </Dialog>
  );
}

export function InsuranceDialog({
  tripId,
  insurance,
  onClose,
}: Close & { tripId: string; insurance: PlanInsurance | null }) {
  const save = useSaveInsurance(tripId);
  const remove = useDeleteInsurance(tripId);
  const feedback = useFeedback(onClose);
  const [company, setCompany] = useState(insurance?.company ?? '');
  const [policy, setPolicy] = useState(insurance?.policy ?? '');
  const [coverage, setCoverage] = useState(insurance?.coverage ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(insurance?.emergencyPhone ?? '');
  const [document, setDocument] = useState<DocumentChange>(KEEP);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Assicurazione di viaggio"
      subtitle="Compagnia, polizza e centrale operativa h24"
    >
      <SlotForm
        canSave={!!company.trim() && !!policy.trim()}
        saving={save.isPending}
        onSubmit={() =>
          save.mutate(
            {
              company: company.trim(),
              policy: policy.trim(),
              coverage: coverage.trim(),
              emergencyPhone: emergencyPhone.trim(),
              document,
            },
            feedback('Polizza aggiornata'),
          )
        }
        onDelete={insurance ? () => remove.mutate(undefined, feedback('Polizza rimossa')) : undefined}
        deleteLabel="Rimuovi la polizza"
        deleting={remove.isPending}
      >
        <Field
          label="Compagnia"
          placeholder="es. Europ Assistance"
          value={company}
          maxLength={50}
          onChange={(event) => setCompany(event.target.value)}
        />
        <Field
          label="Numero polizza"
          placeholder="VM-00000-XX"
          value={policy}
          maxLength={24}
          onChange={(event) => setPolicy(event.target.value)}
        />
        <Field
          label="Copertura"
          placeholder="es. fino al 24/09"
          value={coverage}
          maxLength={50}
          onChange={(event) => setCoverage(event.target.value)}
        />
        <Field
          label="Centrale h24"
          type="tel"
          placeholder="+39 02 0000 0000"
          value={emergencyPhone}
          onChange={(event) => setEmergencyPhone(event.target.value)}
        />
        <DocumentField
          label="Polizza (PDF)"
          current={insurance?.doc}
          change={document}
          onChange={setDocument}
        />
      </SlotForm>
    </Dialog>
  );
}

export function CustomsDialog({
  tripId,
  customs,
  onClose,
}: Close & { tripId: string; customs: PlanCustoms | null }) {
  const save = useSaveCustoms(tripId);
  const remove = useDeleteCustoms(tripId);
  const feedback = useFeedback(onClose);
  const [code, setCode] = useState(customs?.code ?? '');
  const [note, setNote] = useState(customs?.note ?? '');
  const [document, setDocument] = useState<DocumentChange>(KEEP);

  return (
    <Dialog
      open
      onClose={onClose}
      title="Modulo doganale / QR"
      subtitle="Il codice diventa il QR mostrato nell'app"
    >
      <SlotForm
        canSave={!!code.trim()}
        saving={save.isPending}
        onSubmit={() =>
          save.mutate({ code: code.trim(), note: note.trim(), document }, feedback('Modulo aggiornato'))
        }
        onDelete={customs ? () => remove.mutate(undefined, feedback('Modulo rimosso')) : undefined}
        deleteLabel="Rimuovi il modulo"
        deleting={remove.isPending}
      >
        <Field
          label="Codice pratica"
          placeholder="es. KEF-4472-IS"
          value={code}
          maxLength={24}
          onChange={(event) => setCode(event.target.value)}
        />
        <Field
          label="Note"
          placeholder="Paese e punto di ingresso"
          value={note}
          maxLength={80}
          onChange={(event) => setNote(event.target.value)}
        />
        <DocumentField
          label="Ricevuta o QR"
          current={customs?.doc}
          change={document}
          onChange={setDocument}
        />
      </SlotForm>
    </Dialog>
  );
}

const MODES: ReadonlyArray<{ key: TransportMode; label: string }> = [
  { key: 'van', label: '🚐 Van / auto' },
  { key: 'flight', label: '✈️ Volo' },
  { key: 'ferry', label: '⛴️ Traghetto' },
];

export function TransportDialog({
  tripId,
  transport,
  onClose,
}: Close & { tripId: string; transport: PlanTransport | null }) {
  const save = useSaveTransport(tripId);
  const remove = useDeleteTransport(tripId);
  const feedback = useFeedback(onClose);
  const [name, setName] = useState(transport?.name ?? '');
  const [reference, setReference] = useState(transport?.reference ?? '');
  const [mode, setMode] = useState<TransportMode>(transport?.mode ?? 'van');
  const [docs, setDocs] = useState<
    Array<TransportDocDraft & { current: PlanTransport['docs'][number]['doc'] }>
  >(
    transport?.docs.length
      ? transport.docs.map((doc) => ({ id: doc.id, label: doc.label, document: KEEP, current: doc.doc }))
      : [{ label: 'Contratto o biglietto', document: KEEP, current: null }],
  );
  const patchDoc = (index: number, patch: Partial<(typeof docs)[number]>) =>
    setDocs((previous) => previous.map((doc, position) => (position === index ? { ...doc, ...patch } : doc)));

  return (
    <Dialog
      open
      onClose={onClose}
      title={transport ? 'Modifica il mezzo' : 'Nuovo mezzo'}
      subtitle="Noleggio, volo o traghetto, con i suoi documenti"
    >
      <SlotForm
        canSave={!!name.trim() && docs.every((doc) => doc.label.trim())}
        saving={save.isPending}
        onSubmit={() =>
          save.mutate(
            {
              transportId: transport?.id,
              name: name.trim(),
              reference: reference.trim(),
              mode,
              docs: docs.map(({ id, label, document }) => ({ id, label: label.trim(), document })),
            },
            feedback(transport ? 'Mezzo aggiornato' : 'Mezzo aggiunto'),
          )
        }
        onDelete={transport ? () => remove.mutate(transport.id, feedback('Mezzo eliminato')) : undefined}
        deleteLabel="Elimina il mezzo"
        deleting={remove.isPending}
      >
        <Segmented label="Tipo di mezzo" options={MODES} value={mode} onChange={setMode} />
        <Field
          label="Mezzo"
          placeholder="es. Van 4x4 noleggiato"
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
        />
        <Field
          label="Riferimento"
          placeholder="Targa, numero volo, molo e orario"
          value={reference}
          maxLength={120}
          onChange={(event) => setReference(event.target.value)}
        />
        {docs.map((doc, index) => (
          <div key={doc.id ?? `new-${index}`} className="flex flex-col gap-2">
            <div className="flex items-end gap-2">
              <Field
                label={`Documento ${index + 1}`}
                placeholder="es. Polizza kasko"
                value={doc.label}
                maxLength={40}
                onChange={(event) => patchDoc(index, { label: event.target.value })}
                className="flex-1"
              />
              {docs.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Togli ${doc.label || 'questo documento'}`}
                  onClick={() => setDocs((previous) => previous.filter((_, position) => position !== index))}
                  className="mb-1 flex h-11 w-11 items-center justify-center rounded-[14px] border border-ink-700 bg-ink-900 text-bone/70 hover:text-bone"
                >
                  <X size={16} strokeWidth={2.2} />
                </button>
              ) : null}
            </div>
            <DocumentField
              label={doc.label || 'File'}
              current={doc.current}
              change={doc.document}
              onChange={(document) => patchDoc(index, { document })}
            />
          </div>
        ))}
        {docs.length < 10 ? (
          <button
            type="button"
            onClick={() => setDocs((previous) => [...previous, { label: '', document: KEEP, current: null }])}
            className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-dashed border-ink-700 text-[13.5px] font-extrabold text-tangerine-soft hover:bg-ink-850"
          >
            <Plus size={16} strokeWidth={2.4} /> Aggiungi un documento
          </button>
        ) : null}
      </SlotForm>
    </Dialog>
  );
}

const emptyContact = (): EmergencyDraft => ({
  title: '',
  subtitle: '',
  actionLabel: 'Chiama',
  phone: '',
  whatsapp: false,
});

export function EmergenciesDialog({
  tripId,
  contacts,
  onClose,
}: Close & { tripId: string; contacts: PlanEmergency[] }) {
  const save = useSaveEmergencies(tripId);
  const feedback = useFeedback(onClose);
  const [drafts, setDrafts] = useState<EmergencyDraft[]>(
    contacts.length
      ? contacts.map(({ title, subtitle, actionLabel, phone, whatsapp }) => ({
          title,
          subtitle,
          actionLabel,
          phone,
          whatsapp,
        }))
      : [emptyContact()],
  );
  const patch = (index: number, change: Partial<EmergencyDraft>) =>
    setDrafts((previous) =>
      previous.map((draft, position) => (position === index ? { ...draft, ...change } : draft)),
    );
  const filled = drafts.filter((draft) => draft.title.trim() || draft.phone.trim());

  return (
    <Dialog
      open
      onClose={onClose}
      title="Contatti SOS"
      subtitle="Le card di emergenza del viaggio, nell'ordine in cui compaiono nell'app"
    >
      <SlotForm
        canSave={filled.every(
          (draft) => draft.title.trim() && draft.phone.trim() && draft.actionLabel.trim(),
        )}
        saving={save.isPending}
        onSubmit={() =>
          save.mutate(
            filled.map((draft) => ({
              ...draft,
              title: draft.title.trim(),
              subtitle: draft.subtitle.trim(),
              actionLabel: draft.actionLabel.trim(),
              phone: draft.phone.trim(),
            })),
            feedback('Contatti SOS aggiornati'),
          )
        }
      >
        {drafts.map((draft, index) => (
          <div
            key={index}
            className="flex flex-col gap-3 rounded-[18px] border border-ink-700 bg-ink-850 p-3.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold tracking-wide text-bone/60 uppercase">
                Contatto {index + 1}
              </span>
              <button
                type="button"
                onClick={() => setDrafts((previous) => previous.filter((_, position) => position !== index))}
                className="text-[12.5px] font-bold text-danger hover:underline"
              >
                Togli
              </button>
            </div>
            <Field
              label="Titolo"
              placeholder="es. Coordinatore del viaggio"
              value={draft.title}
              maxLength={80}
              onChange={(event) => patch(index, { title: event.target.value })}
            />
            <Field
              label="Sottotitolo"
              placeholder="es. Sofia, sempre raggiungibile"
              value={draft.subtitle}
              maxLength={160}
              onChange={(event) => patch(index, { subtitle: event.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Telefono"
                type="tel"
                placeholder="+39 333 000 0000"
                value={draft.phone}
                onChange={(event) => patch(index, { phone: event.target.value })}
              />
              <Field
                label="Bottone"
                placeholder="Chiama"
                value={draft.actionLabel}
                maxLength={60}
                onChange={(event) => patch(index, { actionLabel: event.target.value })}
              />
            </div>
            <label className="flex items-center gap-2.5 text-[13.5px] font-bold text-bone">
              <input
                type="checkbox"
                checked={draft.whatsapp}
                onChange={(event) => patch(index, { whatsapp: event.target.checked })}
                className="h-4 w-4 accent-[#C5161D]"
              />
              Raggiungibile anche su WhatsApp
            </label>
          </div>
        ))}
        {drafts.length < 10 ? (
          <button
            type="button"
            onClick={() => setDrafts((previous) => [...previous, emptyContact()])}
            className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-dashed border-ink-700 text-[13.5px] font-extrabold text-tangerine-soft hover:bg-ink-850"
          >
            <Plus size={16} strokeWidth={2.4} /> Aggiungi un contatto
          </button>
        ) : null}
      </SlotForm>
    </Dialog>
  );
}
