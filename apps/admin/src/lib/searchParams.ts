/**
 * Filtri, ricerca e pagina stanno nell'indirizzo, così un link porta alla
 * stessa lista. `null` o stringa vuota tolgono il parametro.
 */
export function withParams(params: URLSearchParams, changes: Record<string, string | null | undefined>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    if (value) next.set(key, value);
    else next.delete(key);
  }
  return next;
}

/** La pagina, 1-based nell'indirizzo e 0-based nel codice. */
export const pageFromParams = (params: URLSearchParams) =>
  Math.max(0, Number(params.get('pagina') ?? '1') - 1) || 0;
export const pageParam = (page: number | undefined) =>
  page === undefined ? undefined : page > 0 ? String(page + 1) : null;
