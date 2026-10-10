import { describe, expect, it } from 'vitest';

import { createTestApp } from '../helpers/app.js';

const WEB_ORIGIN = 'https://app.example.com';

async function preflight(method: string, origin = WEB_ORIGIN) {
  const { app } = await createTestApp({ config: { CORS_ORIGIN: [WEB_ORIGIN] } });
  return app.inject({
    method: 'OPTIONS',
    url: '/api/trips/00000000-0000-4000-8000-000000000000/days/1/stay',
    headers: {
      origin,
      'access-control-request-method': method,
      'access-control-request-headers': 'authorization, content-type',
    },
  });
}

describe('CORS', () => {
  // Il client web modifica i dati con PUT, PATCH e DELETE: il preflight deve ammetterli tutti.
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])(
    'lets the web app send %s with a token',
    async (method) => {
      const response = await preflight(method);

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
      expect(String(response.headers['access-control-allow-methods']).split(/,\s*/)).toContain(method);
      expect(String(response.headers['access-control-allow-headers'])).toMatch(/authorization/i);
    },
  );

  it('does not open the API to other origins', async () => {
    const response = await preflight('PUT', 'https://evil.example.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
