import { RotateCw } from 'lucide-react';

import { errorMessage } from '@/api/client';

import { Button } from './Button';
import { EmptyState } from './EmptyState';

/** Una lettura non riuscita: il perché in parole, e un modo per riprovare. */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <EmptyState
      emoji="📡"
      title="Non si è caricato"
      hint={errorMessage(error, 'Il server non ha risposto come doveva.')}
      action={
        <Button variant="ghost" size="sm" icon={<RotateCw size={15} strokeWidth={2.2} />} onClick={onRetry}>
          Riprova
        </Button>
      }
    />
  );
}
