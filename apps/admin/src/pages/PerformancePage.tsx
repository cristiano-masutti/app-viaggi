import { useState } from 'react';
import { useSearchParams } from 'react-router';

import { usePerformance } from '@/api/queries';
import type { AdminPerformance, PerfMetric, TelemetrySource } from '@/api/types';
import { ChartCard, DataTable } from '@/components/charts/ChartCard';
import { TrendChart } from '@/components/charts/TrendChart';
import { PageBody, PageHeader } from '@/components/layout/PageHeader';
import { RangeFilter, useRange } from '@/components/metrics/RangeFilter';
import { Card, SectionLabel } from '@/components/ui/Card';
import { cn } from '@/components/ui/cn';
import { EmptyState } from '@/components/ui/EmptyState';
import { QueryError } from '@/components/ui/QueryError';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusChip } from '@/components/ui/StatusChip';
import { eachDayISO, shortDate } from '@/lib/dates';
import {
  formatCount,
  formatMetric,
  METRICS,
  PLATFORM_LABELS,
  rate,
  RATING_LABELS,
  SOURCE_LABELS,
  SOURCE_METRICS,
  targetLabel,
} from '@/lib/metrics';
import { withParams } from '@/lib/searchParams';

type Row = AdminPerformance['metrics'][number];

/**
 * Quanto sono veloci e fluidi app e pannello, come li sente chi li usa: il
 * p75 di ogni misura (tre volte su quattro va meglio di così), il suo
 * andamento e dove si perde tempo.
 */
export function PerformancePage() {
  const [range, setRange] = useRange();
  const [params, setParams] = useSearchParams();
  const source: TelemetrySource = params.get('fonte') === 'pannello' ? 'panel' : 'app';
  const performance = usePerformance({ days: range, source });

  return (
    <>
      <PageHeader title="Prestazioni" subtitle="Velocità e fluidità, come le sente chi usa app e pannello ⚡">
        <div className="flex flex-wrap gap-3">
          <Segmented
            label="Cosa misurare"
            className="w-full sm:w-[240px]"
            options={(['app', 'panel'] as const).map((key) => ({ key, label: SOURCE_LABELS[key] }))}
            value={source}
            onChange={(next) =>
              setParams(withParams(params, { fonte: next === 'panel' ? 'pannello' : null }), {
                replace: true,
              })
            }
          />
          <RangeFilter value={range} onChange={setRange} />
        </div>
      </PageHeader>
      <PageBody>
        {performance.isError ? (
          <QueryError error={performance.error} onRetry={() => void performance.refetch()} />
        ) : !performance.data || performance.data.source !== source ? (
          <PerformanceSkeleton />
        ) : (
          <PerformanceContent
            key={source}
            performance={performance.data}
            refreshing={performance.isPlaceholderData}
          />
        )}
      </PageBody>
    </>
  );
}

function PerformanceContent({
  performance,
  refreshing,
}: {
  performance: AdminPerformance;
  refreshing: boolean;
}) {
  const metrics = SOURCE_METRICS[performance.source];
  const [selected, setSelected] = useState<PerfMetric>(metrics[0]!);
  const byMetric = new Map(performance.metrics.map((row) => [row.metric, row]));

  if (performance.metrics.length === 0)
    return (
      <EmptyState
        emoji="⏱️"
        title="Nessuna misura nel periodo"
        hint={
          performance.source === 'app'
            ? "Le misure arrivano quando qualcuno usa l'app collegata al backend."
            : 'Le misure arrivano mentre lo staff usa il pannello.'
        }
      />
    );

  return (
    <>
      <section aria-labelledby="vitals" className="flex flex-col gap-3.5">
        <SectionLabel accent hint="p75 · tocca una misura per l'andamento">
          <span id="vitals">Come va</span>
        </SectionLabel>
        <div
          className={cn(
            'grid grid-cols-2 gap-3.5 transition-opacity lg:grid-cols-5',
            refreshing && 'opacity-50',
          )}
        >
          {metrics.map((metric) => (
            <MetricTile
              key={metric}
              metric={metric}
              row={byMetric.get(metric)}
              selected={metric === selected}
              onSelect={() => setSelected(metric)}
            />
          ))}
        </div>
      </section>

      <DailyCard performance={performance} metric={selected} refreshing={refreshing} />

      <section aria-labelledby="targets" className="flex flex-col gap-3.5">
        <SectionLabel hint="dal più lento">
          <span id="targets">Dove si perde tempo</span>
        </SectionLabel>
        <Targets performance={performance} refreshing={refreshing} />
      </section>

      <Platforms performance={performance} />

      <p className="text-[12px] font-semibold text-mist">
        Il p75 è il valore sotto cui sta tre misure su quattro: un'app lenta per una persona su quattro è
        un'app lenta, anche se la media è bella. Le misure sono anonime e si cancellano dopo 180 giorni.
      </p>
    </>
  );
}

function MetricTile({
  metric,
  row,
  selected,
  onSelect,
}: {
  metric: PerfMetric;
  row: Row | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const info = METRICS[metric];
  const rating = row ? rate(metric, row.p75) : null;
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex flex-col items-start gap-2 rounded-card border bg-ink-900 p-4 text-left transition-colors hover:bg-ink-850',
        selected ? 'border-series/70 ring-2 ring-series/25' : 'border-ink-700',
      )}
    >
      <span className="text-[13px] font-bold text-mist">{info.label}</span>
      <span className="text-[28px] leading-none font-extrabold tracking-tight text-bone">
        {row ? formatMetric(metric, row.p75) : '—'}
      </span>
      {rating ? <StatusChip status={rating} label={RATING_LABELS[rating]} /> : null}
      <span className="flex flex-col text-[12px] font-semibold text-bone/60">
        {row ? (
          <>
            <span>
              mediana {formatMetric(metric, row.p50)} · p95 {formatMetric(metric, row.p95)}
            </span>
            <span>{formatCount(row.count)} misure</span>
          </>
        ) : (
          'nessuna misura nel periodo'
        )}
      </span>
    </button>
  );
}

function DailyCard({
  performance,
  metric,
  refreshing,
}: {
  performance: AdminPerformance;
  metric: PerfMetric;
  refreshing: boolean;
}) {
  const info = METRICS[metric];
  const byDay = new Map(
    performance.daily.filter((row) => row.metric === metric).map((row) => [row.day, row] as const),
  );
  const days = eachDayISO(performance.from, performance.to);
  const format = (value: number) => formatMetric(metric, value);

  return (
    <ChartCard
      title={`${info.label}, giorno per giorno`}
      description={`${info.description}. Il p75 di ogni giorno; la riga è il limite del buono.`}
      chart={
        <TrendChart
          points={days.map((day) => ({
            key: day,
            label: shortDate(day),
            value: byDay.get(day)?.p75 ?? null,
          }))}
          seriesLabel={`${info.label} · p75`}
          format={format}
          threshold={
            info.good > 0 ? { value: info.good, label: `buono fino a ${format(info.good)}` } : undefined
          }
          dimmed={refreshing}
        />
      }
      table={
        <DataTable
          caption={`${info.label}: p75 giorno per giorno`}
          columns={['Giorno', 'p75', 'Misure']}
          rows={days.map((day) => {
            const row = byDay.get(day);
            return {
              key: day,
              cells: [shortDate(day), row ? format(row.p75) : '—', row ? formatCount(row.count) : '0'],
            };
          })}
        />
      }
    />
  );
}

function Targets({ performance, refreshing }: { performance: AdminPerformance; refreshing: boolean }) {
  const groups = SOURCE_METRICS[performance.source]
    .map((metric) => ({
      metric,
      rows: performance.targets.filter((row) => row.metric === metric).slice(0, 8),
    }))
    .filter((group) => group.rows.length > 0);

  if (groups.length === 0)
    return (
      <EmptyState
        emoji="🔎"
        title="Nessun dettaglio nel periodo"
        hint="Schermate e chiamate compaiono qui."
      />
    );

  return (
    <div className={cn('grid grid-cols-1 gap-3.5 transition-opacity', refreshing && 'opacity-50')}>
      {groups.map(({ metric, rows }) => (
        // Sul telefono la tabella scorre: col focus si scorre anche da tastiera.
        <Card
          key={metric}
          className="flex flex-col gap-2 overflow-x-auto p-4"
          tabIndex={0}
          role="region"
          aria-label={`${METRICS[metric].label}: dove si perde tempo`}
        >
          <h3 className="text-[15px] font-extrabold tracking-tight text-white">
            {METRICS[metric].label}{' '}
            <span className="text-[12.5px] font-semibold text-mist">
              {metric === 'api_latency'
                ? 'per chiamata'
                : performance.source === 'app'
                  ? 'per schermata'
                  : 'per pagina'}
            </span>
          </h3>
          <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
            <caption className="sr-only">{METRICS[metric].label}: dove si perde tempo</caption>
            <thead>
              <tr className="text-[11px] font-extrabold tracking-wide text-bone/55 uppercase">
                <th scope="col" className="border-b border-ink-700 py-2 pr-2">
                  Dove
                </th>
                <th scope="col" className="border-b border-ink-700 px-2 py-2 text-right">
                  Mediana
                </th>
                <th scope="col" className="border-b border-ink-700 px-2 py-2 text-right">
                  p75
                </th>
                <th scope="col" className="border-b border-ink-700 px-2 py-2 text-right">
                  p95
                </th>
                <th scope="col" className="border-b border-ink-700 py-2 pl-2 text-right">
                  Giudizio
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rating = rate(metric, row.p75);
                return (
                  <tr key={row.target} className="border-b border-ink-700/60 last:border-0">
                    <th
                      scope="row"
                      className={cn(
                        'max-w-[460px] truncate py-2 pr-2 font-bold text-bone',
                        metric === 'api_latency' && 'font-mono text-[12px] font-semibold',
                      )}
                      title={targetLabel(metric, row.target)}
                    >
                      {targetLabel(metric, row.target)}
                    </th>
                    <td className="px-2 py-2 text-right font-semibold whitespace-nowrap text-bone/70 tabular-nums">
                      {formatMetric(metric, row.p50)}
                    </td>
                    <td className="px-2 py-2 text-right font-extrabold whitespace-nowrap text-bone tabular-nums">
                      {formatMetric(metric, row.p75)}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold whitespace-nowrap text-bone/70 tabular-nums">
                      {formatMetric(metric, row.p95)}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      <StatusChip status={rating} label={RATING_LABELS[rating]} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

/** Un dispositivo più lento degli altri si vede qui; con un solo dispositivo non serve. */
function Platforms({ performance }: { performance: AdminPerformance }) {
  const platforms = [...new Set(performance.platforms.map((row) => row.platform))];
  if (platforms.length < 2) return null;
  const metrics = SOURCE_METRICS[performance.source].filter((metric) =>
    performance.platforms.some((row) => row.metric === metric),
  );
  const cell = (platform: string, metric: PerfMetric) =>
    performance.platforms.find((row) => row.platform === platform && row.metric === metric);

  return (
    <section aria-labelledby="by-platform" className="flex flex-col gap-3.5">
      <SectionLabel hint="p75">
        <span id="by-platform">Per dispositivo</span>
      </SectionLabel>
      <Card className="overflow-x-auto p-4" tabIndex={0} role="region" aria-label="p75 per dispositivo">
        <DataTable
          caption="p75 per dispositivo"
          columns={['Misura', ...platforms.map((platform) => PLATFORM_LABELS[platform])]}
          rows={metrics.map((metric) => ({
            key: metric,
            cells: [
              METRICS[metric].label,
              ...platforms.map((platform) => {
                const row = cell(platform, metric);
                return row ? formatMetric(metric, row.p75) : '—';
              }),
            ],
          }))}
        />
      </Card>
    </section>
  );
}

function PerformanceSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-[150px] rounded-card" />
        ))}
      </div>
      <Skeleton className="h-[330px] rounded-card" />
    </>
  );
}
