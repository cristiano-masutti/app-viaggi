import { BrandMark } from '@/components/layout/BrandMark';
import { Card } from '@/components/ui/Card';

/** Il pannello non mostra mai dati finti: senza backend lo dice e spiega come collegarlo. */
export function MissingConfigPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950 px-5">
      <Card className="flex w-full max-w-[480px] flex-col gap-4 p-7">
        <BrandMark size={44} />
        <h1 className="text-[24px] font-extrabold tracking-tight text-white">Manca la configurazione</h1>
        <p className="text-[14px] leading-[21px] font-semibold text-mist">
          Copia <code className="text-cream">apps/admin/.env.example</code> in{' '}
          <code className="text-cream">.env.local</code>, compila le tre variabili e riavvia:
        </p>
        <ul className="flex flex-col gap-1.5 font-mono text-[13px] text-cream">
          <li>VITE_API_URL</li>
          <li>VITE_SUPABASE_URL</li>
          <li>VITE_SUPABASE_KEY</li>
        </ul>
      </Card>
    </div>
  );
}
