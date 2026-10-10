import type { FastifyInstance, onRequestAsyncHookHandler } from 'fastify';

import { AppError } from '../lib/errors.js';
import type { PrismaClient } from '../lib/prisma.js';
import { type AuthenticatedUser, AuthUnavailableError, InvalidTokenError } from './token-verifier.js';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * L'utente che fa la richiesta. Valorizzato dall'hook di autenticazione,
     * quindi presente in tutte le route sotto `/api` e solo lì.
     */
    user: AuthenticatedUser;
  }
}

const BEARER_TOKEN = /^Bearer[ ]+([A-Za-z0-9._~+/=-]+)[ ]*$/i;

export function extractBearerToken(header: string | undefined): string | null {
  return header?.match(BEARER_TOKEN)?.[1] ?? null;
}

/**
 * Crea la riga `User` alla prima richiesta di un utente appena registrato su
 * Supabase e tiene allineata l'email se cambia. Nel caso normale è una sola
 * lettura per chiave primaria.
 */
export async function ensureUser(prisma: PrismaClient, user: AuthenticatedUser) {
  const existing = await prisma.user.findUnique({ where: { id: user.id }, select: { email: true } });

  if (!existing) {
    // ON CONFLICT DO NOTHING: due prime richieste in parallelo non fanno un 500.
    await prisma.user.createMany({ data: [{ id: user.id, email: user.email }], skipDuplicates: true });
    return;
  }

  if (user.email && existing.email !== user.email) {
    await prisma.user.update({ where: { id: user.id }, data: { email: user.email } });
  }
}

const unauthenticated = () =>
  new AppError(401, 'UNAUTHENTICATED', 'Missing bearer token', {
    headers: { 'www-authenticate': 'Bearer' },
  });

const invalidToken = (cause: unknown) =>
  new AppError(401, 'INVALID_TOKEN', 'Invalid or expired access token', {
    headers: { 'www-authenticate': 'Bearer error="invalid_token"' },
    cause,
  });

/**
 * Hook `onRequest` per tutte le route protette: gira prima che il body venga
 * letto, quindi una richiesta senza token valido non arriva mai a fare upload.
 */
export function createAuthenticateHook(app: FastifyInstance): onRequestAsyncHookHandler {
  return async (request) => {
    const token = extractBearerToken(request.headers.authorization);
    if (!token) throw unauthenticated();

    try {
      request.user = await app.tokenVerifier.verify(token);
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        // Il motivo serve a chi fa debug del client; il token non finisce mai nei log.
        request.log.info({ reason: error.message }, 'Rejected access token');
        throw invalidToken(error);
      }
      if (error instanceof AuthUnavailableError) {
        throw new AppError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable', {
          cause: error,
        });
      }
      throw error;
    }

    await ensureUser(app.prisma, request.user);
  };
}
