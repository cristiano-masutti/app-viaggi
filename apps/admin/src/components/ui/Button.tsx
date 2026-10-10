import { forwardRef, type ComponentProps, type ReactNode } from 'react';

import { cn } from './cn';

type Variant = 'primary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

const VARIANTS: Record<Variant, string> = {
  // Il bottone pieno dell'app: rosso, testo bianco, alone dello stesso rosso.
  primary:
    'bg-tangerine text-white shadow-glow hover:bg-[#d61c23] disabled:bg-ink-700 disabled:text-bone/45 disabled:shadow-none',
  ghost: 'border border-ink-700 bg-ink-900 text-bone hover:bg-ink-800 disabled:text-bone/40',
  danger: 'border border-danger/35 bg-danger/10 text-danger hover:bg-danger/15 disabled:opacity-50',
};

const SIZES: Record<Size, string> = {
  md: 'h-12 gap-2.5 rounded-control px-5 text-[15px]',
  sm: 'h-[38px] gap-2 rounded-[14px] px-3.5 text-[13px]',
};

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    icon,
    loading = false,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-extrabold tracking-tight transition-colors disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
          aria-hidden
        />
      ) : (
        icon
      )}
      {children}
    </button>
  );
});
