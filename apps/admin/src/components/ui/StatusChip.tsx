import { AlertTriangle, Check, X } from 'lucide-react';

import { cn } from './cn';

export type Status = 'ok' | 'warn' | 'bad';

const STYLES: Record<Status, { box: string; Icon: typeof Check }> = {
  ok: { box: 'border-success/30 bg-success/10 text-success', Icon: Check },
  warn: { box: 'border-warning/30 bg-warning/10 text-warning', Icon: AlertTriangle },
  bad: { box: 'border-danger/30 bg-danger/10 text-danger', Icon: X },
};

/** Uno stato si legge sempre da icona e parole, mai dal solo colore. */
export function StatusChip({
  status,
  label,
  className,
}: {
  status: Status;
  label: string;
  className?: string;
}) {
  const { box, Icon } = STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1 text-[12px] font-bold whitespace-nowrap',
        box,
        className,
      )}
    >
      <Icon size={13} strokeWidth={2.6} aria-hidden />
      {label}
    </span>
  );
}
