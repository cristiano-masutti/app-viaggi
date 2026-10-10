import type { ReactNode } from 'react';

import { Card } from './Card';
import { cn } from './cn';

/** Un numero da colpo d'occhio: etichetta, valore, una riga di contesto. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
}) {
  return (
    <Card
      className={cn(
        'flex flex-col gap-2 p-5',
        accent && 'border-tangerine/40 bg-gradient-to-b from-tangerine/12 to-ink-900',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-mist">{label}</span>
        {icon ? <span className={cn(accent ? 'text-tangerine-soft' : 'text-bone/40')}>{icon}</span> : null}
      </div>
      <span className="text-[34px] leading-none font-extrabold tracking-tight text-bone">{value}</span>
      {hint ? <span className="text-[12.5px] font-semibold text-bone/55">{hint}</span> : null}
    </Card>
  );
}
