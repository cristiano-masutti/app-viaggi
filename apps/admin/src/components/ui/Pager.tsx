import { ChevronLeft, ChevronRight } from 'lucide-react';

/** "21–40 di 54" e le frecce: il totale arriva dall'API, le pagine si contano qui. */
export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total <= pageSize) return null;
  const first = page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);
  const button =
    'flex h-10 w-10 items-center justify-center rounded-[14px] border border-ink-700 bg-ink-900 text-bone hover:bg-ink-800 disabled:opacity-35';

  return (
    <nav aria-label="Pagine" className="flex items-center justify-end gap-3">
      <span className="text-[13px] font-bold text-mist tabular-nums">
        {first}–{last} di {total}
      </span>
      <button
        type="button"
        className={button}
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        aria-label="Pagina precedente"
      >
        <ChevronLeft size={18} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        className={button}
        onClick={() => onPage(page + 1)}
        disabled={last >= total}
        aria-label="Pagina successiva"
      >
        <ChevronRight size={18} strokeWidth={2.2} />
      </button>
    </nav>
  );
}
