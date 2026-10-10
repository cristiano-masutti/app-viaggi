import { cn } from './cn';

type Tone = 'live' | 'accent' | 'neutral';

/** Gli stessi toni chiari delle pillole dell'app, leggibili su qualunque fondo. */
const TONES: Record<Tone, string> = {
  live: 'border-[#15803D] bg-[#EAFBF1] text-[#15803D]',
  accent: 'border-[#A31219] bg-[#FCE9EA] text-[#A31219]',
  neutral: 'border-[#475569] bg-[#EEF2F7] text-[#475569]',
};

/** Pillola di stato: `LIVE • GIORNO 3 DI 10`, `⏳ Mancano 18 giorni`, `🎒 Concluso`. */
export function Badge({
  label,
  tone = 'neutral',
  pulse = false,
}: {
  label: string;
  tone?: Tone;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 self-start rounded-chip border px-3 py-[6px] text-[11px] font-extrabold tracking-wide whitespace-nowrap',
        TONES[tone],
      )}
    >
      {pulse ? <PulseDot /> : null}
      {label}
    </span>
  );
}

/** Il respiro del pallino LIVE: un solo elemento animato per schermata. */
export function PulseDot() {
  return (
    <span className="relative inline-flex h-[7px] w-[7px]" aria-hidden>
      <span className="absolute inset-0 animate-pulse-dot rounded-full bg-live" />
      <span className="relative h-[7px] w-[7px] rounded-full bg-live" />
    </span>
  );
}
