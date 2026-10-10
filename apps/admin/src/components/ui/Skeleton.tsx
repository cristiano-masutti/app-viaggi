import { cn } from './cn';

/**
 * Placeholder di caricamento, come nell'app: nessuno spinner, un blocco
 * `ink-700` della forma del contenuto che arriva, attraversato da un'onda di luce.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden bg-ink-700', className)} aria-hidden>
      <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-bone/[0.07] to-transparent" />
    </div>
  );
}
