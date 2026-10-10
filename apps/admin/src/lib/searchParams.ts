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
export function pageFromParams(params: URLSearchParams): number {
  // Solo interi positivi: `pagina=2.01` o `pagina=-3` portano alla prima pagina, non a un 400.
  const raw = params.get('pagina') ?? '1';
  return /^[1-9]\d{0,4}$/.test(raw) ? Number(raw) - 1 : 0;
}
export const pageParam = (page: number | undefined) =>
  page === undefined ? undefined : page > 0 ? String(page + 1) : null;
