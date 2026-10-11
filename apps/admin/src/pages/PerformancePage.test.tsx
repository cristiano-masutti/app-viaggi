import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdminPerformance } from '@/api/types';
import { fakeFetch, fakeSupabase } from '@/test/fakes';
import { performanceFixture } from '@/test/metrics';
import { renderWithProviders } from '@/test/render';

import { PerformancePage } from './PerformancePage';

function renderPage(byPanel: AdminPerformance = performanceFixture()) {
  const app = performanceFixture();
  // Il finto backend risponde secondo `source`, come quello vero.
  const routes = fakeFetch({});
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname !== '/api/admin/performance') return routes(input, init);
    const body = url.searchParams.get('source') === 'panel' ? byPanel : app;
    return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetch);
  renderWithProviders(
    <MemoryRouter initialEntries={['/prestazioni']}>
      <PerformancePage />
    </MemoryRouter>,
    fakeSupabase({ email: 'giulia@vibemakers.test' }),
  );
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PerformancePage', () => {
  it('judges each measure by its p75, with words and an icon', async () => {
    renderPage();
    const start = await screen.findByRole('button', { name: /Avvio dell'app/ });
    expect(start).toHaveTextContent('1,85 s');
    expect(start).toHaveTextContent('Buono');
    expect(start).toHaveTextContent('mediana 1,40 s · p95 3,20 s');
    expect(start).toHaveTextContent('40 misure');

    expect(screen.getByRole('button', { name: /Fotogrammi lenti/ })).toHaveTextContent('Scarso');
    expect(screen.getByRole('button', { name: /Blocchi/ })).toHaveTextContent('nessuna misura nel periodo');
  });

  it('shows where time goes, slowest first, per screen and per call', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'Schermate pronte: dove si perde tempo' });
    const row = within(table).getByRole('row', { name: /Dettaglio viaggio/ });
    expect(row).toHaveTextContent('2,70 s');
    expect(row).toHaveTextContent('Scarso');
    expect(screen.getByRole('table', { name: 'Risposta del server: dove si perde tempo' })).toHaveTextContent(
      'GET /api/trips/{tripId}',
    );
  });

  it('compares devices when there is more than one', async () => {
    renderPage();
    const table = await screen.findByRole('table', { name: 'p75 per dispositivo' });
    expect(within(table).getByRole('row', { name: /Avvio dell'app/ })).toHaveTextContent(/1,50 s.*2,30 s/);
  });

  it('switches to the panel own measures', async () => {
    const user = userEvent.setup();
    const fetch = renderPage(
      performanceFixture({
        source: 'panel',
        metrics: [{ metric: 'lcp', count: 12, p50: 1200, p75: 2900, p95: 5000 }],
        daily: [],
        targets: [],
        platforms: [],
      }),
    );
    await screen.findByRole('button', { name: /Avvio dell'app/ });

    await user.click(screen.getByRole('tab', { name: 'Pannello' }));

    const lcp = await screen.findByRole('button', { name: /Caricamento/ });
    expect(lcp).toHaveTextContent('2,90 s');
    expect(lcp).toHaveTextContent('Da migliorare');
    const last = new URL((fetch.mock.calls.at(-1)![0] as Request).url);
    expect(last.searchParams.get('source')).toBe('panel');
  });

  it('explains an empty period instead of showing empty charts', async () => {
    const user = userEvent.setup();
    renderPage(performanceFixture({ source: 'panel', metrics: [], daily: [], targets: [], platforms: [] }));
    await screen.findByRole('button', { name: /Avvio dell'app/ });
    await user.click(screen.getByRole('tab', { name: 'Pannello' }));
    expect(await screen.findByText('Nessuna misura nel periodo')).toBeInTheDocument();
  });
});
