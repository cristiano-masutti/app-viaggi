import { Search } from 'lucide-react';
import { forwardRef, type ComponentProps, type ReactNode, useId } from 'react';

import { cn } from './cn';

interface FieldProps extends ComponentProps<'input'> {
  label?: string;
  icon?: ReactNode;
  trailing?: ReactNode;
  error?: string | null;
}

/** Il campo dell'app: ink-900, bordo che si accende di rosso dove si sta scrivendo. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, icon, trailing, error, className, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <label htmlFor={inputId} className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <span className="text-[10.5px] font-bold tracking-[0.8px] text-bone/45 uppercase">{label}</span>
      ) : null}
      <span
        className={cn(
          'flex h-[52px] items-center gap-3 rounded-control border bg-ink-900 pr-2 pl-4 transition-colors focus-within:border-tangerine',
          error ? 'border-danger/60' : 'border-ink-700',
        )}
      >
        {icon ? <span className="text-mist">{icon}</span> : null}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-bold text-bone outline-none placeholder:font-semibold placeholder:text-mist"
          {...props}
        />
        {trailing}
      </span>
      {error ? <span className="text-[12.5px] font-bold text-danger">{error}</span> : null}
    </label>
  );
});

export function SearchField(props: Omit<FieldProps, 'icon' | 'type'>) {
  return <Field type="search" icon={<Search size={18} strokeWidth={2} />} autoComplete="off" {...props} />;
}
