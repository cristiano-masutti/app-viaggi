import { Plus, UserMinus } from 'lucide-react';
import { useState } from 'react';

import { errorMessage } from '@/api/client';
import { useAddInvitations } from '@/api/plan';
import { useAddMember, useRemoveMember, useUpdateMemberRole } from '@/api/queries';
import type { AdminMember, AdminUser, TripRole } from '@/api/types';
import { PersonPicker } from '@/components/people/PersonPicker';
import { SlotForm } from '@/components/plan/SlotForm';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { useToast } from '@/components/ui/Toast';
import { fullName, ROLE_LABELS } from '@/lib/people';

const ROLES: ReadonlyArray<{ key: TripRole; label: string }> = [
  { key: 'traveller', label: 'Viaggiatore' },
  { key: 'coordinator', label: 'Coordinatore' },
];

/** Mette nel viaggio una persona che ha già un account. */
export function AddMemberDialog({
  tripId,
  memberIds,
  onClose,
}: {
  tripId: string;
  memberIds: string[];
  onClose: () => void;
}) {
  const add = useAddMember(tripId);
  const toast = useToast();
  const [person, setPerson] = useState<AdminUser | null>(null);
  const [role, setRole] = useState<TripRole>('traveller');

  return (
    <Dialog
      open
      onClose={onClose}
      title="Aggiungi alla crew"
      subtitle="Entra subito nel viaggio, senza passare dal link"
    >
      <SlotForm
        canSave={!!person}
        saving={add.isPending}
        saveLabel={person ? `Aggiungi ${person.firstName || fullName(person)}` : 'Aggiungi'}
        onSubmit={() =>
          person &&
          add.mutate(
            { userId: person.id, role },
            {
              onSuccess: () => {
                toast.show(`${fullName(person)} è nella crew`);
                onClose();
              },
              onError: (error) => toast.show(errorMessage(error), 'error'),
            },
          )
        }
      >
        <Segmented label="Ruolo" options={ROLES} value={role} onChange={setRole} />
        <PersonPicker selected={person} onSelect={setPerson} disabledIds={memberIds} />
      </SlotForm>
    </Dialog>
  );
}

/** Ruolo e uscita dal viaggio di un membro della crew. */
export function MemberDialog({
  tripId,
  member,
  onClose,
}: {
  tripId: string;
  member: AdminMember;
  onClose: () => void;
}) {
  const updateRole = useUpdateMemberRole(tripId);
  const remove = useRemoveMember(tripId);
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const name = fullName(member);
  const fail = (error: unknown) => toast.show(errorMessage(error), 'error');

  return (
    <>
      <Dialog open={!confirming} onClose={onClose} title={name} subtitle={member.email ?? 'senza email'}>
        <div className="flex flex-col gap-4">
          <Segmented
            label="Ruolo nel viaggio"
            options={ROLES}
            value={member.role}
            onChange={(role) =>
              role !== member.role &&
              updateRole.mutate(
                { userId: member.userId, role },
                {
                  onSuccess: () => toast.show(`${name} ora è ${ROLE_LABELS[role].toLowerCase()}`),
                  onError: fail,
                },
              )
            }
          />
          <p className="text-[12.5px] font-semibold text-mist">
            I coordinatori organizzano il viaggio dall'app: programma, documenti e crew.
          </p>
          <Button
            variant="danger"
            icon={<UserMinus size={16} strokeWidth={2.2} />}
            onClick={() => setConfirming(true)}
          >
            Togli dal viaggio
          </Button>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title={`Togliere ${name} dal viaggio?`}
        message="Non vedrà più il viaggio nell'app. I ricordi che ha pubblicato restano alla crew."
        confirmLabel="Togli"
        loading={remove.isPending}
        onClose={() => setConfirming(false)}
        onConfirm={() =>
          remove.mutate(member.userId, {
            onSuccess: () => {
              toast.show(`${name} non è più nel viaggio`);
              onClose();
            },
            onError: (error) => {
              setConfirming(false);
              fail(error);
            },
          })
        }
      />
    </>
  );
}

/** Posti tenuti per chi entrerà col link: con l'email, il posto si chiude da solo quando entra. */
export function InvitationsDialog({ tripId, onClose }: { tripId: string; onClose: () => void }) {
  const add = useAddInvitations(tripId);
  const toast = useToast();
  const [rows, setRows] = useState([{ name: '', email: '' }]);
  const filled = rows.filter((row) => row.name.trim());
  const patch = (index: number, change: Partial<{ name: string; email: string }>) =>
    setRows((previous) =>
      previous.map((row, position) => (position === index ? { ...row, ...change } : row)),
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Riserva posti"
      subtitle="Per chi non ha ancora l'app: il posto resta suo finché non entra"
    >
      <SlotForm
        canSave={filled.length > 0}
        saving={add.isPending}
        saveLabel={filled.length > 1 ? `Riserva ${filled.length} posti` : 'Riserva il posto'}
        onSubmit={() =>
          add.mutate(
            filled.map((row) => ({ name: row.name.trim(), email: row.email.trim() || undefined })),
            {
              onSuccess: () => {
                toast.show(filled.length > 1 ? 'Posti riservati' : 'Posto riservato');
                onClose();
              },
              onError: (error) => toast.show(errorMessage(error), 'error'),
            },
          )
        }
      >
        {rows.map((row, index) => (
          <div key={index} className="grid grid-cols-[1fr_1.3fr] gap-3">
            <Field
              label="Nome"
              placeholder="es. Aisha B."
              value={row.name}
              maxLength={60}
              onChange={(event) => patch(index, { name: event.target.value })}
            />
            <Field
              label="Email (facoltativa)"
              type="email"
              placeholder="aisha@…"
              value={row.email}
              onChange={(event) => patch(index, { email: event.target.value })}
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows((previous) => [...previous, { name: '', email: '' }])}
          className="flex h-11 items-center justify-center gap-2 rounded-[14px] border border-dashed border-ink-700 text-[13.5px] font-extrabold text-tangerine-soft hover:bg-ink-850"
        >
          <Plus size={16} strokeWidth={2.4} /> Un altro posto
        </button>
      </SlotForm>
    </Dialog>
  );
}
