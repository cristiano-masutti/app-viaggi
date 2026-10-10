import { Trash2 } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';

import { Button } from '@/components/ui/Button';

/** Il corpo comune dei fogli di modifica: i campi, poi "Salva" e, se c'è, "Rimuovi". */
export function SlotForm({
  children,
  onSubmit,
  canSave,
  saving,
  saveLabel = 'Salva modifiche',
  onDelete,
  deleteLabel,
  deleting = false,
}: {
  children: ReactNode;
  onSubmit: () => void;
  canSave: boolean;
  saving: boolean;
  saveLabel?: string;
  onDelete?: () => void;
  deleteLabel?: string;
  deleting?: boolean;
}) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (canSave && !saving) onSubmit();
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {children}
      <Button type="submit" disabled={!canSave} loading={saving} className="mt-2">
        {saveLabel}
      </Button>
      {onDelete ? (
        <Button
          variant="danger"
          icon={<Trash2 size={15} strokeWidth={2} />}
          loading={deleting}
          onClick={onDelete}
        >
          {deleteLabel}
        </Button>
      ) : null}
    </form>
  );
}
