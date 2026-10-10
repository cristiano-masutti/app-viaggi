import { Button } from './Button';
import { Dialog } from './Dialog';

/** Niente cancellazioni silenziose: una domanda chiara e due bottoni. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  loading = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={title}>
      <p className="text-[14px] leading-[21px] font-semibold text-mist">{message}</p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Button variant="ghost" onClick={onClose}>
          Annulla
        </Button>
        <Button variant="danger" loading={loading} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
