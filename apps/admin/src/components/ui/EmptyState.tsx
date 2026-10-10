import type { ReactNode } from 'react';

import { cn } from './cn';

/** Stato vuoto tratteggiato, come i placeholder dell'app: dice cosa manca, non solo che è vuoto. */
export function EmptyState({
  emoji,
  title,
  hint,
  action,
  className,
}: {
  emoji?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-dashed border-ink-700 px-6 py-10 text-center',
        className,
      )}
    >
      {emoji ? (
        <span className="text-[26px]" aria-hidden>
          {emoji}
        </span>
      ) : null}
      <p className="text-[15px] font-extrabold tracking-tight text-bone">{title}</p>
      {hint ? <p className="max-w-sm text-[13px] leading-[19px] font-semibold text-mist">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
