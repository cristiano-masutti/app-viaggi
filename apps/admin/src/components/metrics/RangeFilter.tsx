import { useSearchParams } from 'react-router';

import { Segmented } from '@/components/ui/Segmented';
import { RANGES, type Range, rangeFromParams, withParams } from '@/lib/searchParams';

/** Il periodo delle metriche, nell'indirizzo: un link porta allo stesso grafico. */
export function useRange(): [Range, (range: Range) => void] {
  const [params, setParams] = useSearchParams();
  const range = rangeFromParams(params);
  return [
    range,
    (next) => setParams(withParams(params, { giorni: next === 30 ? null : String(next) }), { replace: true }),
  ];
}

export function RangeFilter({ value, onChange }: { value: Range; onChange: (range: Range) => void }) {
  return (
    <Segmented
      label="Periodo"
      className="w-full sm:w-[330px]"
      options={RANGES.map((range) => ({ key: String(range) as `${Range}`, label: `${range} giorni` }))}
      value={String(value) as `${Range}`}
      onChange={(key) => onChange(Number(key) as Range)}
    />
  );
}
