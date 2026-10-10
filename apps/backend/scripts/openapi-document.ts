import { buildApp } from '../src/app.js';
import type { TokenVerifier } from '../src/auth/token-verifier.js';
import { loadConfig } from '../src/config/env.js';
import type { PrismaClient } from '../src/lib/prisma.js';
import type { ObjectStorage } from '../src/storage/storage.js';

/**
 * La specifica dell'app vera, costruita senza database né storage: per
 * descrivere le route non serve eseguirne nessuna. JSON stabile, con a capo
 * finale, così il diff in revisione mostra solo i cambi reali.
 */
export async function buildOpenApiDocument(): Promise<string> {
  const app = await buildApp(
    {
      config: loadConfig({
        DATABASE_URL: 'postgresql://openapi@localhost/openapi',
        SUPABASE_URL: 'https://openapi.supabase.invalid',
        SUPABASE_SERVICE_ROLE_KEY: 'openapi',
      }),
      // Mai chiamati: la specifica si ricava dalle route, senza eseguirle.
      prisma: {} as PrismaClient,
      storage: {} as ObjectStorage,
      tokenVerifier: {} as TokenVerifier,
    },
    { logger: false },
  );
  await app.ready();
  const document = JSON.stringify(app.swagger(), null, 2) + '\n';
  await app.close();
  return document;
}
