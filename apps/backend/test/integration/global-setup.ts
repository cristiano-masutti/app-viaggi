import { execFileSync } from 'node:child_process';

import { testDatabaseUrl } from '../helpers/test-database.js';

/**
 * Prima dell'intera suite: le migrazioni versionate vengono applicate al
 * database di test con `migrate deploy`, lo stesso comando che girerà in
 * produzione. Se una migrazione è rotta, la suite si ferma qui.
 */
export default function setup() {
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
