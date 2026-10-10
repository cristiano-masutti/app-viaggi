import { BrandMark } from './BrandMark';

/** Mentre si scopre chi c'è dall'altra parte: il segno del pannello, nient'altro. */
export function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink-950" role="status">
      <div className="animate-pulse">
        <BrandMark size={56} />
      </div>
      <span className="sr-only">Caricamento del pannello</span>
    </div>
  );
}
