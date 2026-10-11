import { execFileSync } from 'node:child_process';

import { DATABASE_URL, NOW, PATHS } from './stack.mjs';

/**
 * Prima di ogni giro: migrazioni e dati demo da capo, con lo stesso "adesso"
 * dei server. Il seed rifiuta un database che non abbia `e2e` o `demo` nel nome.
 */
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL, DEMO_NOW: NOW };
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { cwd: PATHS.backend, env, stdio: 'inherit' });
  execFileSync('npm', ['run', '-s', 'seed:demo'], { cwd: PATHS.backend, env, stdio: 'inherit' });
}
