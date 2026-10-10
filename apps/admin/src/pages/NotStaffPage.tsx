import { LogOut } from 'lucide-react';

import { BrandMark } from '@/components/layout/BrandMark';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

/**
 * Chi ha un account ma non è staff. Il ruolo si concede solo da riga di
 * comando, quindi la pagina dice esattamente cosa chiedere e a chi.
 */
export function NotStaffPage({ email, onSignOut }: { email: string | null; onSignOut: () => void }) {
  const command = `npm run staff -- grant ${email ?? '<email>'}`;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-5">
      <Card className="flex w-full max-w-[460px] animate-rise flex-col gap-4 p-7">
        <BrandMark size={44} />
        <h1 className="text-[24px] font-extrabold tracking-tight text-white">Quest'area è per lo staff</h1>
        <p className="text-[14px] leading-[21px] font-semibold text-mist">
          Sei entrato come <span className="text-bone">{email ?? 'utente senza email'}</span>, ma questo
          account non è abilitato al pannello di controllo. Chiedi a chi gestisce il server di eseguire, nella
          cartella del backend:
        </p>
        <code className="rounded-[14px] border border-ink-700 bg-ink-950 px-4 py-3 font-mono text-[13px] break-all text-cream">
          {command}
        </code>
        <Button
          variant="ghost"
          icon={<LogOut size={17} strokeWidth={2.2} />}
          onClick={onSignOut}
          className="mt-2"
        >
          Esci
        </Button>
      </Card>
    </div>
  );
}
