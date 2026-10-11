import { type KeyboardEvent, type PointerEvent, useId, useRef, useState } from 'react';

import { cn } from '@/components/ui/cn';
import { niceTicks } from '@/lib/metrics';

export interface TrendPoint {
  /** Identità del punto (il giorno ISO). */
  key: string;
  /** Come si legge sull'asse e nel tooltip: '14 Set'. */
  label: string;
  /** `null` = nessun dato quel giorno: la linea si interrompe, non scende a zero. */
  value: number | null;
}

const PLOT_HEIGHT = 190;
const X_LABELS = 5;

/**
 * Una serie nel tempo: linea di 2px con una velatura sotto, griglia a
 * filo, mirino che si aggancia al giorno più vicino e tooltip con il valore.
 * Con la tastiera: frecce, Home e Fine. Una soglia facoltativa ("obiettivo")
 * è una riga sottile con la sua etichetta.
 */
export function TrendChart({
  points,
  seriesLabel,
  format,
  formatTick = format,
  threshold,
  dimmed = false,
}: {
  points: readonly TrendPoint[];
  seriesLabel: string;
  format: (value: number) => string;
  formatTick?: (value: number) => string;
  threshold?: { value: number; label: string };
  dimmed?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const descriptionId = useId();

  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  const ticks = niceTicks(Math.max(...values, threshold?.value ?? 0, 0));
  const top = ticks[ticks.length - 1]!;
  const x = (index: number) => (points.length === 1 ? 50 : (index / (points.length - 1)) * 100);
  const y = (value: number) => 100 - (value / top) * 100;

  const segments = splitSegments(points);
  const lastIndex = findLastIndex(points, (point) => point.value !== null);
  const activePoint = active === null ? null : points[active];

  const pick = (index: number) => setActive(Math.max(0, Math.min(points.length - 1, index)));

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = overlay.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    pick(Math.round(((event.clientX - box.left) / box.width) * (points.length - 1)));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: (active ?? lastIndex) - 1,
      ArrowRight: (active ?? lastIndex) + 1,
      Home: 0,
      End: points.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    pick(next);
  };

  return (
    <figure className={cn('m-0 transition-opacity', dimmed && 'opacity-50')}>
      {/* Con una soglia le linee sono due: la legenda dice quale è quale. */}
      {threshold ? (
        <figcaption className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] font-semibold text-mist">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-series" aria-hidden />
            {seriesLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-px w-4 bg-bone/45" aria-hidden />
            {threshold.label}
          </span>
        </figcaption>
      ) : null}
      <div className="flex gap-2">
        {/* Asse dei valori: solo etichette, la griglia fa il resto. */}
        <div className="relative w-[52px] shrink-0" style={{ height: PLOT_HEIGHT }} aria-hidden>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 -translate-y-1/2 text-[11px] font-semibold text-mist tabular-nums"
              style={{ top: `${y(tick)}%` }}
            >
              {formatTick(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: PLOT_HEIGHT }}>
            {ticks.map((tick) => (
              <div
                key={tick}
                className="absolute inset-x-0 h-px bg-ink-700"
                style={{ top: `${y(tick)}%` }}
                aria-hidden
              />
            ))}

            {threshold ? (
              <div
                className="absolute inset-x-0 h-px bg-bone/45"
                style={{ top: `${y(threshold.value)}%` }}
                aria-hidden
              />
            ) : null}

            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              {segments.map((segment) => (
                <path
                  key={`area-${segment[0]}`}
                  d={areaPath(segment, points, x, y)}
                  className="fill-series"
                  fillOpacity={0.1}
                />
              ))}
              {segments.map((segment) => (
                <path
                  key={`line-${segment[0]}`}
                  d={linePath(segment, points, x, y)}
                  className="stroke-series"
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>

            {/* Un giorno isolato fra due buchi non ha una linea: resta un punto. */}
            {segments
              .filter((segment) => segment.length === 1 && segment[0] !== lastIndex)
              .map(([index]) => (
                <Dot key={`dot-${index}`} left={x(index!)} top={y(points[index!]!.value!)} />
              ))}
            {lastIndex >= 0 && active === null ? (
              <Dot left={x(lastIndex)} top={y(points[lastIndex]!.value!)} />
            ) : null}

            {activePoint && active !== null ? (
              <>
                <div
                  className="pointer-events-none absolute inset-y-0 w-px bg-bone/40"
                  style={{ left: `${x(active)}%` }}
                  aria-hidden
                />
                {activePoint.value !== null ? <Dot left={x(active)} top={y(activePoint.value)} /> : null}
                <Tooltip
                  left={x(active)}
                  top={activePoint.value === null ? 50 : y(activePoint.value)}
                  value={activePoint.value === null ? 'Nessun dato' : format(activePoint.value)}
                  seriesLabel={seriesLabel}
                  dayLabel={activePoint.label}
                />
              </>
            ) : null}

            <div
              ref={overlay}
              role="img"
              tabIndex={0}
              aria-label={`${seriesLabel}, ${points[0]?.label ?? ''} – ${points[points.length - 1]?.label ?? ''}. Frecce per scorrere i giorni.`}
              aria-describedby={descriptionId}
              className="absolute inset-0 cursor-crosshair rounded-[6px]"
              onPointerMove={onPointerMove}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(active ?? Math.max(lastIndex, 0))}
              onBlur={() => setActive(null)}
              onKeyDown={onKeyDown}
            />
            <p id={descriptionId} className="sr-only" aria-live="polite">
              {activePoint
                ? `${activePoint.label}: ${activePoint.value === null ? 'nessun dato' : format(activePoint.value)}`
                : ''}
            </p>
          </div>

          {/* Asse dei giorni: pochi riferimenti, il primo e l'ultimo sempre. */}
          <div className="relative mt-2 h-4" aria-hidden>
            {xLabelIndexes(points.length).map((index, position) => (
              <span
                key={index}
                className={cn(
                  'absolute text-[11px] font-semibold whitespace-nowrap text-mist tabular-nums',
                  // Sul telefono cinque date si toccano: restano la prima, quella di mezzo e l'ultima.
                  position % 2 === 1 && 'max-sm:hidden',
                  index === 0
                    ? 'translate-x-0'
                    : index === points.length - 1
                      ? '-translate-x-full'
                      : '-translate-x-1/2',
                )}
                style={{ left: `${x(index)}%` }}
              >
                {points[index]!.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

/** Il punto della serie: 8px, con un anello del colore della card per staccarsi dalla linea. */
function Dot({ left, top }: { left: number; top: number }) {
  return (
    <span
      className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink-900 bg-series"
      style={{ left: `${left}%`, top: `${top}%` }}
      aria-hidden
    />
  );
}

function Tooltip({
  left,
  top,
  value,
  seriesLabel,
  dayLabel,
}: {
  left: number;
  top: number;
  value: string;
  seriesLabel: string;
  dayLabel: string;
}) {
  // Vicino ai bordi si apre verso l'interno, così non esce dalla card.
  const align =
    left > 70 ? '-translate-x-[calc(100%+12px)]' : left < 30 ? 'translate-x-3' : '-translate-x-1/2';
  const vertical =
    left >= 30 && left <= 70
      ? top < 40
        ? 'translate-y-4'
        : '-translate-y-[calc(100%+12px)]'
      : '-translate-y-1/2';
  return (
    <div
      className={cn(
        'pointer-events-none absolute z-10 min-w-[132px] rounded-[14px] border border-ink-700 bg-ink-850/95 px-3 py-2 shadow-card backdrop-blur',
        align,
        vertical,
      )}
      style={{ left: `${left}%`, top: `${top}%` }}
      aria-hidden
    >
      <p className="text-[16px] leading-tight font-extrabold text-white tabular-nums">{value}</p>
      <p className="mt-1 flex items-center gap-1.5 text-[11.5px] font-semibold text-mist">
        <span className="h-0.5 w-3 rounded-full bg-series" />
        {seriesLabel}
      </p>
      <p className="text-[11.5px] font-semibold text-bone/55">{dayLabel}</p>
    </div>
  );
}

/** Gli indici consecutivi con un valore: ogni gruppo è un tratto di linea. */
function splitSegments(points: readonly TrendPoint[]): number[][] {
  const segments: number[][] = [];
  let current: number[] = [];
  points.forEach((point, index) => {
    if (point.value === null) {
      if (current.length) segments.push(current);
      current = [];
    } else current.push(index);
  });
  if (current.length) segments.push(current);
  return segments;
}

type Scale = (value: number) => number;

function linePath(segment: number[], points: readonly TrendPoint[], x: Scale, y: Scale) {
  return segment
    .map((index, position) => `${position === 0 ? 'M' : 'L'}${x(index)},${y(points[index]!.value!)}`)
    .join(' ');
}

function areaPath(segment: number[], points: readonly TrendPoint[], x: Scale, y: Scale) {
  const first = segment[0]!;
  const last = segment[segment.length - 1]!;
  return `M${x(first)},100 ${linePath(segment, points, x, y).replace(/^M/, 'L')} L${x(last)},100 Z`;
}

/** Al più cinque etichette di giorno, distribuite, sempre con la prima e l'ultima. */
export function xLabelIndexes(length: number): number[] {
  if (length <= X_LABELS) return Array.from({ length }, (_, index) => index);
  const step = (length - 1) / (X_LABELS - 1);
  return Array.from({ length: X_LABELS }, (_, index) => Math.round(index * step));
}

function findLastIndex<T>(items: readonly T[], predicate: (item: T) => boolean) {
  for (let index = items.length - 1; index >= 0; index -= 1) if (predicate(items[index]!)) return index;
  return -1;
}
