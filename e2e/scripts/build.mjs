/**
 * Prepara quello che gli e2e servono: il backend compilato, il pannello e
 * l'app web costruiti per parlare con il backend e il Supabase finto locali.
 * Le build finiscono in `e2e/.build`, separate da quelle di sviluppo.
 */
import { spawnSync } from 'node:child_process';

import { PATHS, URLS } from '../support/stack.mjs';

function run(label, command, args, options = {}) {
  console.log(`\n▸ ${label}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    console.error(`✖ ${label} (uscita ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

const only = process.argv[2];

if (!only || only === 'backend') run('Backend', 'npm', ['run', 'build'], { cwd: PATHS.backend });

if (!only || only === 'panel')
  run('Pannello', 'npx', ['vite', 'build', '--outDir', PATHS.panelBuild, '--emptyOutDir'], {
    cwd: PATHS.admin,
    env: {
      VITE_API_URL: URLS.api,
      VITE_SUPABASE_URL: URLS.supabase,
      VITE_SUPABASE_KEY: 'e2e-publishable-key',
    },
  });

if (!only || only === 'app')
  run(
    'App (web)',
    'npx',
    ['expo', 'export', '--platform', 'web', '--output-dir', PATHS.appBuild, '--clear'],
    {
      cwd: PATHS.mobile,
      env: {
        EXPO_PUBLIC_API_URL: URLS.api,
        EXPO_PUBLIC_SUPABASE_URL: URLS.supabase,
        EXPO_PUBLIC_SUPABASE_KEY: 'e2e-publishable-key',
      },
    },
  );
