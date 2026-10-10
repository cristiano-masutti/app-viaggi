import { cn } from './cn';

/**
 * Il selettore dei segmenti dell'hub: una pillola rossa sull'opzione attiva,
 * dentro un contenitore ink-900.
 */
export function Segmented<Key extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: ReadonlyArray<{ key: Key; label: string; count?: number }>;
  value: Key;
  onChange: (key: Key) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn('flex h-[52px] gap-1 rounded-control border border-ink-700 bg-ink-900 p-1.5', className)}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-[12px] px-3 text-[13px] font-extrabold transition-colors',
              active ? 'bg-tangerine text-white' : 'text-bone/80 hover:bg-ink-800',
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span className={cn('text-[12px] font-bold', active ? 'text-white/75' : 'text-mist')}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
