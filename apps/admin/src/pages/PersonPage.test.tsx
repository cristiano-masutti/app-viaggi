import { screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AdminUserDetail } from '@/api/types';
import { fakeFetch, fakeSupabase } from '@/test/fakes';
import { renderWithProviders } from '@/test/render';

import { PersonPage } from './PersonPage';

const ID = '00000000-0000-4000-8000-000000000001';

const person = (passport: AdminUserDetail['passport']): AdminUserDetail => ({
  id: ID,
  email: 'sofia@example.test',
  firstName: 'Sofia',
  lastName: 'Marchi',
  username: 'sofia',
  isAdmin: false,
  createdAt: '2027-08-01T10:00:00.000Z',
  tripCount: 0,
  passport,
  lastSeenAt: null,
  usage: { appOpens: 0, screenViews: 0, documentOpens: 0 },
  trips: [],
});

function renderPage(user: AdminUserDetail) {
  vi.stubGlobal('fetch', fakeFetch({ [`GET /api/admin/users/${ID}`]: [200, { user }] }));
  renderWithProviders(
    <MemoryRouter initialEntries={[`/persone/${ID}`]}>
      <Routes>
        <Route path="/persone/:userId" element={<PersonPage />} />
      </Routes>
    </MemoryRouter>,
    fakeSupabase({ email: 'giulia@vibemakers.test' }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PersonPage', () => {
  it('says whether the passport is there and when it expires, never the number', async () => {
    renderPage(person({ present: true, expiry: '04/2031' }));
    expect(await screen.findByRole('heading', { name: 'Documenti' })).toBeInTheDocument();
    expect(screen.getByText('scade 04/2031')).toBeInTheDocument();
  });

  it('has no documents card when the server does not handle sensitive data', async () => {
    renderPage(person(null));
    expect(await screen.findByRole('heading', { name: /Sofia Marchi/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Documenti' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Passaporto/)).not.toBeInTheDocument();
  });
});
