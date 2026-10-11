import type { ReactNode } from 'react';

/**
 * Classifica a barre orizzontali: una tinta sola per tutte (le categorie non
 * hanno un ordine proprio), il valore in punta, il dettaglio sotto il nome.
 * Ogni numero è scritto: niente da scoprire passando col mouse.
 */
export function BarList({
  items,
  label,
}: {
  items: ReadonlyArray<{ key: string; label: ReactNode; detail?: ReactNode; value: number; display: string }>;
  label: string;
}) {
  const max = Math.max(...items.map((item) => item.value), 0);
  return (
    <ul aria-label={label} className="flex flex-col gap-3.5">
      {items.map((item) => {
        const ratio = max > 0 ? item.value / max : 0;
        return (
          <li
            key={item.key}
            className="group grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-3"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-extrabold text-bone">{item.label}</span>
              {item.detail ? (
                <span className="block truncate text-[12px] font-semibold text-mist">{item.detail}</span>
              ) : null}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 min-w-[3px] rounded-r-[4px] bg-series transition-[filter] group-hover:brightness-125"
                style={{ width: `calc((100% - 72px) * ${ratio})` }}
                aria-hidden
              />
              <span className="shrink-0 text-[13px] font-extrabold text-bone tabular-nums">
                {item.display}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
