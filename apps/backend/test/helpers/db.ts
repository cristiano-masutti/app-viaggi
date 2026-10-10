import { createPrismaClient } from '../../src/lib/prisma.js';
import { testDatabaseUrl } from './test-database.js';

/** Client condiviso dai test di un file: le route e le asserzioni vedono gli stessi dati. */
export const prisma = createPrismaClient(testDatabaseUrl());

/** Svuota tutte le tabelle applicative, lasciando intatta la cronologia delle migrazioni. */
export async function resetDatabase() {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}
