import { Link } from 'react-router';

import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Pagina non trovata" />
      <PageBody>
        <EmptyState
          emoji="🧭"
          title="Qui non c'è niente"
          hint="Il link è sbagliato oppure quello che cercavi non esiste più."
          action={
            <Link to="/" className="text-[14px] font-extrabold text-tangerine-soft hover:underline">
              Torna alla panoramica
            </Link>
          }
        />
      </PageBody>
    </>
  );
}
