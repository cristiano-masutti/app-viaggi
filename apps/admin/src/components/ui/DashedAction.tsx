import { Plus } from 'lucide-react';

import { cn } from './cn';

/**
 * Il placeholder tratteggiato dell'app: dove il dato manca c'è il modo di
 * aggiungerlo, e porta allo stesso foglio della matita.
 */
export function DashedAction({
  label,
  emoji,
  hint,
  onClick,
  tone = 'accent',
  className,
}: {
  label: string;
  emoji?: string;
  hint?: string;
  onClick: () => void;
  tone?: 'accent' | 'warning';
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-[16px] border border-dashed px-4 py-3 text-[13.5px] font-extrabold transition-colors',
        tone === 'warning'
          ? 'border-warning/40 text-warning hover:bg-warning/5'
          : 'border-ink-700 text-tangerine-soft hover:bg-ink-850',
        className,
      )}
    >
      {emoji ? <span aria-hidden>{emoji}</span> : <Plus size={16} strokeWidth={2.4} />}
      {label}
      {hint ? <span className="font-semibold text-mist">· {hint}</span> : null}
    </button>
  );
}
