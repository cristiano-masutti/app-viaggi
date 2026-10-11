import { CircleAlert, Clock, Smartphone } from 'lucide-react';

import { cn } from '@/components/ui/cn';
import { lastSeenLabel, lastSeenStatus } from '@/lib/metrics';

const STYLES = {
  ok: { Icon: Smartphone, tone: 'text-bone/70' },
  warn: { Icon: Clock, tone: 'text-warning' },
  bad: { Icon: CircleAlert, tone: 'text-danger' },
} as const;

/** L'ultimo ingresso nell'app, con icona e parole: chi non è mai entrato si vede subito. */
export function LastSeen({ lastSeenAt, className }: { lastSeenAt: string | null; className?: string }) {
  const { Icon, tone } = STYLES[lastSeenStatus(lastSeenAt)];
  return (
    <span className={cn('inline-flex items-center gap-1 font-bold whitespace-nowrap', tone, className)}>
      <Icon size={13} strokeWidth={2.4} aria-hidden className="inline shrink-0" />
      {lastSeenAt ? `Nell'app ${lastSeenLabel(lastSeenAt)}` : "Mai entrato nell'app"}
    </span>
  );
}
