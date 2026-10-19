import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

/**
 * La build su Vercel (`npm run vercel-build`, vedi vercel.json).
 *
 * In produzione, prima del codice, le migrazioni: `prisma migrate deploy` su
 * `MIGRATION_DATABASE_URL`, il pooler di Supabase in session mode (porta 5432).
 * Quello in transaction mode (6543) che l'app usa a runtime non regge i lock
 * di migrate. Se una migrazione fallisce la build si ferma e resta online il
 * deploy precedente. Le preview non toccano lo schema.
 */
function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  execFileSync(command, args, { stdio: 'inherit', env });
}

if (process.env.VERCEL_ENV === 'production') {
  const migrationUrl = process.env.MIGRATION_DATABASE_URL;
  if (!migrationUrl) {
    console.error('MIGRATION_DATABASE_URL mancante: serve a prisma migrate deploy.');
    process.exit(1);
  }
  run('npx', ['prisma', 'migrate', 'deploy'], { ...process.env, DATABASE_URL: migrationUrl });
}

run('npm', ['run', 'build']);

// Vercel vuole una cartella di file statici: resta vuota, tutto passa da api/index.js.
mkdirSync('public', { recursive: true });
