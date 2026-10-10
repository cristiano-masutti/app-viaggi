import { describe, expect, it, jest } from '@jest/globals';

import { ApiError, createApiClient, unwrap } from '@/api/client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function setup(response: Response, token: string | null = 'access-token') {
  const requests: Request[] = [];
  const onUnauthorized = jest.fn();
  const client = createApiClient({
    baseUrl: 'https://api.test',
    getAccessToken: async () => token,
    onUnauthorized,
    fetch: async (input) => {
      requests.push(input as Request);
      return response;
    },
  });
  return { client, requests, onUnauthorized };
}

describe('createApiClient', () => {
  it('sends the Supabase access token as a bearer token', async () => {
    const { client, requests } = setup(json(200, { trips: [] }));

    await unwrap(client.GET('/api/trips'));

    expect(requests[0]?.url).toBe('https://api.test/api/trips');
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer access-token');
  });

  it('sends no Authorization header without a session', async () => {
    const { client, requests } = setup(json(200, { trips: [] }), null);

    await unwrap(client.GET('/api/trips'));

    expect(requests[0]?.headers.has('authorization')).toBe(false);
  });

  it('reports a 401 so the app can go back to the login', async () => {
    const { client, onUnauthorized } = setup(json(401, { error: { code: 'INVALID_TOKEN', message: 'expired' } }));

    await expect(unwrap(client.GET('/api/me'))).rejects.toMatchObject({ status: 401, code: 'INVALID_TOKEN' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('unwrap', () => {
  it('turns the error envelope into an ApiError with its stable code', async () => {
    const { client } = setup(
      json(409, { error: { code: 'TRIP_FULL', message: 'All the places in this trip are taken' } }),
    );

    const error = await unwrap(
      client.POST('/api/invites/{code}/accept', { params: { path: { code: 'islanda-abcdefghjkmn' } } }),
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'TRIP_FULL' });
  });

  it('still fails clearly when the server does not answer with the envelope', async () => {
    const { client } = setup(new Response('Bad Gateway', { status: 502 }));

    await expect(unwrap(client.GET('/api/me'))).rejects.toMatchObject({ status: 502, code: 'UNKNOWN_ERROR' });
  });
});
