import { cn } from './cn';

/**
 * Quanto è pieno un viaggio. Il binario è lo stesso rosso, più tenue: si
 * legge come un'unica barra anche quando è quasi vuota.
 */
export function Meter({ ratio, label, className }: { ratio: number; label: string; className?: string }) {
  const percent = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-tangerine/15', className)}
    >
      <div
        className="h-full rounded-full bg-tangerine transition-[width] duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
