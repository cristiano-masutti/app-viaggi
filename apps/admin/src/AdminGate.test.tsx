import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminGate } from '@/AdminGate';
import { fakeFetch, fakeSupabase } from '@/test/fakes';
import { renderWithProviders } from '@/test/render';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('AdminGate', () => {
  it('asks to sign in when there is no session', async () => {
    renderWithProviders(<AdminGate />, fakeSupabase());
    expect(await screen.findByRole('button', { name: 'Accedi' })).toBeInTheDocument();
  });

  it('explains wrong credentials without saying which one is wrong', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AdminGate />, fakeSupabase());

    await user.type(await screen.findByLabelText('Email'), 'giulia@vibemakers.test');
    await user.type(screen.getByLabelText('Password'), 'sbagliata');
    await user.click(screen.getByRole('button', { name: 'Accedi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email o password non corrette.');
  });

  it('turns away who is not staff, telling them the exact command to ask for', async () => {
    vi.stubGlobal(
      'fetch',
      fakeFetch({ 'GET /api/admin/session': [403, { error: { code: 'FORBIDDEN', message: 'Staff only' } }] }),
    );
    renderWithProviders(<AdminGate />, fakeSupabase({ email: 'luca@example.test' }));

    expect(await screen.findByText("Quest'area è per lo staff")).toBeInTheDocument();
    expect(screen.getByText('npm run staff -- grant luca@example.test')).toBeInTheDocument();
  });

  it('sends the session token to the API', async () => {
    const fetch = fakeFetch({
      'GET /api/admin/session': [403, { error: { code: 'FORBIDDEN', message: 'x' } }],
    });
    vi.stubGlobal('fetch', fetch);
    renderWithProviders(<AdminGate />, fakeSupabase({ email: 'luca@example.test' }));

    await screen.findByText("Quest'area è per lo staff");
    const request = fetch.mock.calls[0]![0] as Request;
    expect(request.headers.get('authorization')).toBe('Bearer token-1');
  });
});
