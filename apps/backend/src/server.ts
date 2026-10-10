import 'dotenv/config';

import { buildApp } from './app.js';
import { loadConfig } from './config/env.js';
import { createPrismaClient } from './lib/prisma.js';
import { createSupabaseStorage } from './storage/supabase-storage.js';

/** Oltre questo tempo lo spegnimento non è più "graceful": si esce comunque. */
const SHUTDOWN_TIMEOUT_MS = 10_000;

const config = loadConfig(process.env);
const prisma = createPrismaClient(config.DATABASE_URL);
const storage = createSupabaseStorage({
  url: config.SUPABASE_URL,
  serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
  bucket: config.SUPABASE_STORAGE_BUCKET,
});

const app = await buildApp({ config, prisma, storage });
app.addHook('onClose', async () => {
  await prisma.$disconnect();
});

let shuttingDown = false;

const shutdown = async (signal: NodeJS.Signals) => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'Shutting down');

  const timer = setTimeout(() => {
    app.log.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  try {
    // Smette di accettare connessioni e aspetta le richieste in corso.
    await app.close();
    process.exit(0);
  } catch (error) {
    app.log.error({ err: error }, 'Error during shutdown');
    process.exit(1);
  }
};

process.once('SIGINT', (signal) => void shutdown(signal));
process.once('SIGTERM', (signal) => void shutdown(signal));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.fatal({ err: error }, 'Failed to start backend');
  await prisma.$disconnect();
  process.exit(1);
}
