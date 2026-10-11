/**
 * Da un indirizzo alla sua pagina: `/viaggi/2f1c…` → `/viaggi/:id`. Si
 * raggruppa per pagina, mai per viaggio o persona; un indirizzo sconosciuto
 * diventa `altro`, così nessun testo libero finisce nelle metriche.
 */
const PAGES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/$/, '/'],
  [/^\/viaggi\/?$/, '/viaggi'],
  [/^\/viaggi\/[^/]+\/?$/, '/viaggi/:id'],
  [/^\/persone\/?$/, '/persone'],
  [/^\/persone\/[^/]+\/?$/, '/persone/:id'],
  [/^\/uso\/?$/, '/uso'],
  [/^\/prestazioni\/?$/, '/prestazioni'],
];

export const pagePattern = (pathname: string) =>
  PAGES.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'altro';
