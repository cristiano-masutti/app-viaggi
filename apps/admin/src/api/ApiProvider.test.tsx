import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider } from '@/auth/AuthProvider';
import { PanelTelemetry } from '@/telemetry/PanelTelemetry';
import { fakeFetch, fakeSupabase } from '@/test/fakes';

import { ApiProvider, useApi } from './ApiProvider';

/** Fa una chiamata qualunque e dice quando ha finito. */
function OneCall() {
  const api = useApi();
  const [done, setDone] = useState(false);
  useEffect(() => {
    void api.GET('/api/admin/session').then(() => setDone(true));
  }, [api]);
  return done ? <p>fatto</p> : null;
}

function renderWith(telemetry: PanelTelemetry, email: string | null) {
  const supabase = fakeSupabase({ email });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AuthProvider client={supabase}>
        <ApiProvider baseUrl="https://api.test" telemetry={telemetry}>
          <OneCall />
        </ApiProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
  return supabase;
}

const telemetryCalls = (fetch: ReturnType<typeof fakeFetch>) =>
  fetch.mock.calls
    .map(([input]) => input as Request)
    .filter((request) => request.url.endsWith('/api/telemetry'));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ApiProvider with telemetry', () => {
  it('times the calls and sends them with the session token', async () => {
    const fetch = fakeFetch({
      'GET /api/admin/session': [403, { error: { code: 'FORBIDDEN', message: 'x' } }],
      'POST /api/telemetry': [202, { events: 0, samples: 1 }],
    });
    vi.stubGlobal('fetch', fetch);
    const telemetry = new PanelTelemetry();
    renderWith(telemetry, 'giulia@vibemakers.test');
    await screen.findByText('fatto');

    await telemetry.flush();

    const [upload] = telemetryCalls(fetch);
    expect(upload?.headers.get('authorization')).toBe('Bearer token-1');
    const body = (await upload!.json()) as { source: string; samples: Array<{ target: string }> };
    expect(body.source).toBe('panel');
    expect(body.samples.map((sample) => sample.target)).toEqual(['GET /api/admin/session']);
    expect(telemetry.pending).toBe(0);
  });

  it('waits for a session instead of calling without one (a 401 would sign the login page out)', async () => {
    const fetch = fakeFetch({
      'GET /api/admin/session': [401, { error: { code: 'UNAUTHORIZED', message: 'x' } }],
    });
    vi.stubGlobal('fetch', fetch);
    const telemetry = new PanelTelemetry();
    const supabase = renderWith(telemetry, null);
    await screen.findByText('fatto');
    const signOuts = supabase.auth.signOut.mock.calls.length;

    await telemetry.flush();

    expect(telemetryCalls(fetch)).toHaveLength(0);
    expect(telemetry.pending).toBe(1);
    expect(supabase.auth.signOut.mock.calls.length).toBe(signOuts);
  });
});
