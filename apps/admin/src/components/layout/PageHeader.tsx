import type { ReactNode } from 'react';

/**
 * L'header delle schermate dell'app: titolo grande, sottotitolo con un po' di
 * voce, azioni a destra. Resta in alto con il velo sfocato mentre si scorre.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  leading,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-700/70 bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 pt-6 pb-4 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {leading}
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-white sm:text-[30px]">
              {title}
            </h1>
            {subtitle ? <div className="mt-1 text-[14px] font-semibold text-mist">{subtitle}</div> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
        {children}
      </div>
    </header>
  );
}

/** Il contenuto sotto l'header, con le stesse misure. */
export function PageBody({ children }: { children: ReactNode }) {
  return <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-5 pt-6 sm:px-8">{children}</div>;
}
