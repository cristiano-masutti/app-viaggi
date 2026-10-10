import type { FastifyInstance, InjectOptions } from 'fastify';

import { authHeaders, type TokenUser } from './auth.js';

type Payload = InjectOptions['payload'];

/**
 * L'API vista da un utente: ogni chiamata porta già il suo token.
 *
 *   const alice = await asUser(app, coordinator);
 *   const response = await alice.post(`/api/trips/${id}/transports`, { … });
 */
export async function asUser(app: FastifyInstance, user: TokenUser) {
  const headers = await authHeaders(user);
  const call = (method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') => (url: string, payload?: Payload) =>
    app.inject({ method, url, headers, payload });

  return {
    get: call('GET'),
    post: call('POST'),
    put: call('PUT'),
    patch: call('PATCH'),
    delete: call('DELETE'),
  };
}

export type ApiClient = Awaited<ReturnType<typeof asUser>>;
