import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Configurazione della CLI di Prisma (migrate, generate, studio).
 *
 * `DATABASE_URL` qui è la connessione diretta usata per le migrazioni; a runtime
 * l'app crea il client da `src/config/env.ts`. `generate` non ha bisogno del
 * database, quindi l'assenza della variabile non deve bloccare `npm ci`.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
