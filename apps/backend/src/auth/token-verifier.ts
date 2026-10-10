import { createRemoteJWKSet, errors, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { z } from 'zod';

/** Chi sta facendo la richiesta, ricavato da un access token valido. */
export interface AuthenticatedUser {
  /** Id dell'utente in Supabase Auth (claim `sub`), lo stesso della tabella `User`. */
  id: string;
  email: string | null;
}

/**
 * Verifica un access token e dice a chi appartiene. Le route non conoscono il
 * provider: in produzione dietro c'è Supabase Auth, nei test una coppia di
 * chiavi generata al volo, ma la verifica crittografica è la stessa.
 */
export interface TokenVerifier {
  verify(token: string): Promise<AuthenticatedUser>;
}

/** Il token è scaduto, contraffatto o non è un token utente: per il client è un 401. */
export class InvalidTokenError extends Error {
  constructor(reason: string, options?: { cause?: unknown }) {
    super(`Invalid access token: ${reason}`, options);
    this.name = 'InvalidTokenError';
  }
}

/** Non si riescono a ottenere le chiavi pubbliche per verificare: è un guasto nostro, 503. */
export class AuthUnavailableError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Token verification keys are unavailable', options);
    this.name = 'AuthUnavailableError';
  }
}

/**
 * Solo algoritmi asimmetrici: il backend non conosce nessun segreto con cui si
 * possa firmare un token, e un token HS256 o `alg: none` viene scartato prima
 * ancora di guardare le chiavi.
 */
const ALLOWED_ALGORITHMS = ['ES256', 'RS256'];

/** Tolleranza sugli orologi non perfettamente allineati tra Supabase e il server. */
const CLOCK_TOLERANCE_SECONDS = 10;

/**
 * Claim che pretendiamo da un access token di Supabase. `role` distingue un
 * utente vero dalle chiavi `anon`/`service_role`; gli utenti anonimi
 * (`is_anonymous`) non hanno un account e restano fuori.
 */
const Claims = z.object({
  sub: z.uuid(),
  role: z.literal('authenticated'),
  email: z.string().optional(),
  is_anonymous: z.boolean().optional(),
});

/** Errori di jose che descrivono il token, non un problema nostro. */
const TOKEN_ERRORS = [
  errors.JWTExpired,
  errors.JWTClaimValidationFailed,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
  errors.JWKSNoMatchingKey,
  errors.JWKSMultipleMatchingKeys,
];

interface JwtVerifierOptions {
  /** Risolve la chiave pubblica dall'header del token (`kid`, `alg`). */
  getKey: JWTVerifyGetKey;
  issuer: string;
  audience: string;
}

export function createJwtVerifier({ getKey, issuer, audience }: JwtVerifierOptions): TokenVerifier {
  return {
    async verify(token) {
      let payload: unknown;
      try {
        ({ payload } = await jwtVerify(token, getKey, {
          issuer,
          audience,
          algorithms: ALLOWED_ALGORITHMS,
          clockTolerance: CLOCK_TOLERANCE_SECONDS,
          requiredClaims: ['exp', 'sub'],
        }));
      } catch (error) {
        if (TOKEN_ERRORS.some((TokenError) => error instanceof TokenError)) {
          throw new InvalidTokenError((error as errors.JOSEError).code, { cause: error });
        }
        // Timeout, JWKS malformato, rete giù: il token potrebbe essere buonissimo.
        throw new AuthUnavailableError({ cause: error });
      }

      const claims = Claims.safeParse(payload);
      if (!claims.success) throw new InvalidTokenError('unexpected claims', { cause: claims.error });
      if (claims.data.is_anonymous) throw new InvalidTokenError('anonymous user');

      return { id: claims.data.sub, email: claims.data.email || null };
    },
  };
}

/**
 * Verifica in locale gli access token di Supabase Auth con le chiavi pubbliche
 * del progetto (JWKS), senza una chiamata a Supabase per ogni richiesta: le
 * chiavi restano in cache e si riscaricano solo se arriva un `kid` sconosciuto
 * (rotazione) o dopo 10 minuti.
 *
 * Richiede che il progetto firmi i token con chiavi asimmetriche (JWT Signing
 * Keys); con il vecchio segreto condiviso HS256 il JWKS è vuoto e ogni token
 * viene rifiutato.
 */
export function createSupabaseTokenVerifier(supabaseUrl: string): TokenVerifier {
  const authUrl = `${supabaseUrl.replace(/\/+$/, '')}/auth/v1`;

  return createJwtVerifier({
    getKey: createRemoteJWKSet(new URL(`${authUrl}/.well-known/jwks.json`), {
      timeoutDuration: 5_000,
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    }),
    issuer: authUrl,
    audience: 'authenticated',
  });
}
