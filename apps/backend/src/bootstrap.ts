import { buildApp } from './app.js';
import { createSupabaseAccountAdmin } from './auth/account-admin.js';
import { createSupabaseTokenVerifier } from './auth/token-verifier.js';
import { loadConfig } from './config/env.js';
import { createPrismaClient } from './lib/prisma.js';
import { createSupabaseStorage } from './storage/supabase-storage.js';

/**
 * L'app con le dipendenze vere (Postgres, Supabase), costruita dall'ambiente.
 * La usano il server (`server.ts`) e la Vercel Function (`vercel.ts`): cambia
 * solo come arrivano le richieste.
 */
export async function createProductionApp(env: Record<string, string | undefined>) {
  const config = loadConfig(env);
  const prisma = createPrismaClient(config.DATABASE_URL);
  const storage = createSupabaseStorage({
    url: config.SUPABASE_URL,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
    bucket: config.SUPABASE_STORAGE_BUCKET,
  });

  const tokenVerifier = createSupabaseTokenVerifier(config.SUPABASE_URL);
  const accountAdmin = createSupabaseAccountAdmin({
    url: config.SUPABASE_URL,
    serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  });

  const app = await buildApp({ config, prisma, storage, tokenVerifier, accountAdmin });
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return { app, prisma };
}
