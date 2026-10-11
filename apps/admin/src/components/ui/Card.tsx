import type { ComponentProps, ReactNode } from 'react';

import { cn } from './cn';

/** La superficie di base, come le card dell'app: ink-900, bordo ink-700, raggio 24. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('rounded-card border border-ink-700 bg-ink-900', className)} {...props} />;
}

/** Etichetta di sezione maiuscola: "DOCUMENTI DEL GIORNO". `accent` la accende di rosso. */
export function SectionLabel({
  children,
  hint,
  accent = false,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <h2
        className={cn(
          'text-[11.5px] font-extrabold tracking-[1.2px] uppercase',
          accent ? 'text-tangerine-soft' : 'text-bone/60',
        )}
      >
        {children}
      </h2>
      {hint ? <span className="text-[12px] font-semibold text-mist">{hint}</span> : null}
    </div>
  );
}
