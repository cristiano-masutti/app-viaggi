import { execFileSync } from 'node:child_process';

import { testDatabaseUrl } from '../helpers/test-database.js';

/**
 * Prima dell'intera suite: le migrazioni versionate vengono applicate al
 * database di test con `migrate deploy`, lo stesso comando che girerà in
 * produzione. Se una migrazione è rotta, la suite si ferma qui.
 */
export default function setup() {
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'pipe',
      env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    });
  } catch (error) {
    // L'output di Prisma dice cosa non va (database spento, migrazione rotta…):
    // lo si mostra come testo, non come buffer di byte.
    const { stdout, stderr } = error as { stdout?: Buffer; stderr?: Buffer };
    const output = `${stdout?.toString() ?? ''}${stderr?.toString() ?? ''}`.trim();
    throw new Error(
      `Could not migrate the test database. Is Postgres running (docker compose up -d)?\n\n${output}`,
      { cause: error },
    );
  }
}
