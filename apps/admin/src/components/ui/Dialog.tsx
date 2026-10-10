import { X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Il foglio di modifica dell'app, in versione web: su schermi piccoli sale dal
 * basso come un bottom sheet, su quelli grandi è una card al centro. Esc e il
 * clic fuori chiudono; il focus entra nel foglio e torna dov'era all'uscita.
 */
export function Dialog({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const latestClose = useRef(onClose);
  useEffect(() => {
    latestClose.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const first = panel.current?.querySelector<HTMLElement>(
      'input, select, textarea, button:not([data-close])',
    );
    (first ?? panel.current)?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latestClose.current();
      if (event.key === 'Tab' && panel.current) trapFocus(event, panel.current);
    };
    // Dietro al foglio niente è raggiungibile, né con Tab né con un lettore di schermo.
    const root = document.getElementById('root');
    root?.setAttribute('inert', '');
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      root?.removeAttribute('inert');
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full animate-rise flex-col overflow-hidden rounded-t-hero border border-ink-700 bg-ink-900 shadow-card sm:max-w-lg sm:rounded-hero"
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink-700 sm:hidden" aria-hidden />
        <div className="flex items-start gap-3 px-6 pt-5 pb-3">
          <div className="flex-1">
            <h2 id={titleId} className="text-[19px] font-extrabold tracking-tight text-white">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-[13px] font-semibold text-mist">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Chiudi"
            className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-ink-700 bg-ink-850 text-bone hover:bg-ink-800"
          >
            <X size={17} strokeWidth={2.2} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tab e Maiusc+Tab girano dentro al foglio: dall'ultimo elemento si torna al primo, e viceversa. */
export function trapFocus(event: KeyboardEvent, container: HTMLElement) {
  const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (element) => !element.hasAttribute('inert') && element.getAttribute('aria-hidden') !== 'true',
  );
  if (focusable.length === 0) {
    event.preventDefault();
    container.focus();
    return;
  }
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = document.activeElement;
  const outside = !container.contains(active);
  if (event.shiftKey && (active === first || outside)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || outside)) {
    event.preventDefault();
    first.focus();
  }
}
