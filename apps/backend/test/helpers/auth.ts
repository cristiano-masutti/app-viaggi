import { randomUUID } from 'node:crypto';

import { createLocalJWKSet, type CryptoKey, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';

import { createJwtVerifier } from '../../src/auth/token-verifier.js';

/**
 * Un "Supabase Auth" finto ma crittograficamente vero: una coppia di chiavi
 * ES256 generata a ogni esecuzione. Il verificatore usato dall'app nei test è
 * lo stesso codice della produzione; cambia solo da dove arriva la chiave
 * pubblica (qui in memoria, in produzione dal JWKS del progetto).
 */
export const TEST_ISSUER = 'https://test.supabase.invalid/auth/v1';
const KEY_ID = 'test-signing-key';

const signingKey = await generateKeyPair('ES256', { extractable: true });

export const testJwks: { keys: JWK[] } = {
  keys: [{ ...(await exportJWK(signingKey.publicKey)), kid: KEY_ID, alg: 'ES256', use: 'sig' }],
};

export const testTokenVerifier = createJwtVerifier({
  getKey: createLocalJWKSet(testJwks),
  issuer: TEST_ISSUER,
  audience: 'authenticated',
});

export interface TokenUser {
  id: string;
  email?: string | null;
}

export interface SignTokenOptions {
  /** Claim aggiuntivi o sostitutivi (es. `{ role: 'anon' }`). */
  claims?: Record<string, unknown>;
  /** Es. '1h', oppure un timestamp in secondi; nel passato = token scaduto. */
  expiresAt?: string | number;
  issuer?: string;
  audience?: string;
  kid?: string;
  privateKey?: CryptoKey;
}

/** Un access token come quelli di Supabase Auth, per l'utente indicato. */
export function signToken(user: TokenUser, options: SignTokenOptions = {}): Promise<string> {
  return new SignJWT({
    role: 'authenticated',
    aal: 'aal1',
    is_anonymous: false,
    session_id: randomUUID(),
    ...(user.email ? { email: user.email } : {}),
    ...options.claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: options.kid ?? KEY_ID, typ: 'JWT' })
    .setSubject(user.id)
    .setIssuer(options.issuer ?? TEST_ISSUER)
    .setAudience(options.audience ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(options.expiresAt ?? '1h')
    .sign(options.privateKey ?? signingKey.privateKey);
}

export async function authHeaders(user: TokenUser, options?: SignTokenOptions) {
  return { authorization: `Bearer ${await signToken(user, options)}` };
}

/** Un utente che esiste solo su "Supabase": nel nostro database non c'è ancora. */
export const newAuthUser = (): Required<TokenUser> => {
  const id = randomUUID();
  return { id, email: `user-${id.slice(0, 8)}@example.test` };
};
