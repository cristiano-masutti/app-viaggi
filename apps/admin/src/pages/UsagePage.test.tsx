import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeFetch, fakeSupabase } from '@/test/fakes';
import { usageFixture } from '@/test/metrics';
import { renderWithProviders } from '@/test/render';

import { UsagePage } from './UsagePage';

function renderPage(usage = usageFixture()) {
  const fetch = fakeFetch({ 'GET /api/admin/usage': [200, usage] });
  vi.stubGlobal('fetch', fetch);
  renderWithProviders(
    <MemoryRouter initialEntries={['/uso']}>
      <UsagePage />
    </MemoryRouter>,
    fakeSupabase({ email: 'giulia@vibemakers.test' }),
  );
  return fetch;
}

const requestedUrls = (fetch: ReturnType<typeof fakeFetch>) =>
  fetch.mock.calls.map(([input]) => new URL((input as Request).url));

beforeEach(() => {
  // Solo l'orologio: "visto 25 giorni fa" si calcola da qui.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2027, 8, 14, 12, 0));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('UsagePage', () => {
  it('leads with who is active, against everyone with an account', async () => {
    renderPage();
    expect(await screen.findByText('Attivi oggi')).toBeInTheDocument();
    expect(screen.getByText('su 20 persone con un account')).toBeInTheDocument();
    expect(screen.getByText('45% delle persone')).toBeInTheDocument();
  });

  it('lists who to chase: first who never came in, then who has been away', async () => {
    renderPage();
    const list = (await screen.findByRole('heading', { name: 'Da cercare' })).closest('section')!;
    const rows = within(list).getAllByRole('link');
    expect(rows[0]).toHaveTextContent('Hana Sato');
    expect(rows[0]).toHaveTextContent('Mai entrato');
    expect(rows[0]).toHaveTextContent('parte fra 6 giorni');
    expect(rows[1]).toHaveTextContent('Visto 25 giorni fa');
    expect(rows[0]).toHaveAttribute('href', '/persone/00000000-0000-4000-8000-000000000001');
  });

  it('shows how much of each live crew uses the app', async () => {
    renderPage();
    expect(await screen.findByRole('meter', { name: "4 su 6 hanno usato l'app" })).toBeInTheDocument();
    expect(screen.getByText(/12 documenti aperti/)).toBeInTheDocument();
  });

  it('names screens the way travellers see them', async () => {
    renderPage();
    const screens = await screen.findByRole('list', { name: 'Visite per schermata' });
    expect(within(screens).getByText('I miei viaggi')).toBeInTheDocument();
    expect(within(screens).getByText('120')).toBeInTheDocument();
  });

  it('has the same numbers as a table', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Tabella' }));

    const table = screen.getByRole('table', { name: "Uso dell'app giorno per giorno" });
    const lastDay = within(table).getAllByRole('row').at(-1)!;
    expect(
      within(lastDay)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    ).toEqual(['14 Set', '9', '22', '6']);
  });

  it('asks for the chosen period in the viewer time zone', async () => {
    const user = userEvent.setup();
    const fetch = renderPage();
    await screen.findByText('Attivi oggi');

    await user.click(screen.getByRole('tab', { name: '7 giorni' }));

    await vi.waitFor(() => expect(requestedUrls(fetch).at(-1)?.searchParams.get('days')).toBe('7'));
    const url = requestedUrls(fetch).at(-1)!;
    expect(url.searchParams.get('today')).toBe('2027-09-14');
    expect(url.searchParams.get('tz')).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('says so when everyone travelling is using the app', async () => {
    renderPage(usageFixture({ inactive: { total: 0, people: [] } }));
    expect(await screen.findByText('Tutti dentro')).toBeInTheDocument();
  });
});
