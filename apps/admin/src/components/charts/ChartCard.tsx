import { BarChart3, Table2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';

/**
 * La card di un grafico: titolo, una riga che dice cosa si guarda, i comandi
 * del grafico e il passaggio alla tabella con gli stessi numeri. Il tooltip
 * aiuta, ma nessun valore deve dipendere da lui.
 */
export function ChartCard({
  title,
  description,
  controls,
  chart,
  table,
  className,
}: {
  title: string;
  description?: ReactNode;
  controls?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn('flex flex-col gap-4 p-4 sm:p-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-extrabold tracking-tight text-white">{title}</h3>
          {description ? <p className="mt-0.5 text-[12.5px] font-semibold text-mist">{description}</p> : null}
        </div>
        <button
          type="button"
          aria-pressed={asTable}
          onClick={() => setAsTable((value) => !value)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[12px] border border-ink-700 px-3 text-[12.5px] font-extrabold text-bone/80 transition-colors hover:bg-ink-800 hover:text-bone"
        >
          {asTable ? <BarChart3 size={15} strokeWidth={2.4} /> : <Table2 size={15} strokeWidth={2.4} />}
          {asTable ? 'Grafico' : 'Tabella'}
        </button>
      </div>
      {controls}
      {asTable ? (
        // La tabella scorre (30 o 90 righe): col focus si scorre anche da tastiera.
        <div
          className="max-h-[320px] overflow-auto rounded-[12px]"
          tabIndex={0}
          role="region"
          aria-label={`Tabella: ${title}`}
        >
          {table}
        </div>
      ) : (
        chart
      )}
    </Card>
  );
}

/** Una tabella sobria per la vista alternativa: numeri allineati a destra, in colonna. */
export function DataTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: readonly string[];
  rows: ReadonlyArray<{ key: string; cells: readonly ReactNode[] }>;
}) {
  return (
    <table className="w-full border-collapse text-left text-[13px]">
      <caption className="sr-only">{caption}</caption>
      <thead className="sticky top-0 bg-ink-900">
        <tr>
          {columns.map((column, index) => (
            <th
              key={column}
              scope="col"
              className={cn(
                'border-b border-ink-700 px-2 py-2 text-[11.5px] font-extrabold tracking-wide text-bone/55 uppercase',
                index > 0 && 'text-right',
              )}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-ink-700/60 last:border-0">
            {row.cells.map((cell, index) => (
              <td
                key={index}
                className={cn(
                  'px-2 py-2 font-semibold',
                  index === 0 ? 'text-bone' : 'text-right text-bone/80 tabular-nums',
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
