import { initials } from '@/lib/people';

import { cn } from './cn';

/** Iniziali su fondo ink, con l'anello rosso per chi coordina. */
export function Avatar({
  person,
  size = 36,
  coordinator = false,
}: {
  person: { firstName: string; lastName: string; email?: string | null };
  size?: number;
  coordinator?: boolean;
}) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border bg-ink-800 font-extrabold text-bone',
        coordinator ? 'border-tangerine ring-2 ring-tangerine/25' : 'border-ink-700',
      )}
    >
      {initials(person)}
    </span>
  );
}
