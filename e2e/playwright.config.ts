import { defineConfig, devices } from '@playwright/test';

import { DATABASE_URL, NOW, PATHS, PORTS, URLS } from './support/stack.mjs';

const CI = !!process.env.CI;
/** In locale si può usare un Chromium già installato (es. /opt/pw-browsers/chromium-…/chrome-linux/chrome). */
const executablePath = process.env.E2E_CHROMIUM || undefined;
/** Fuori dalla CI i server già accesi si riusano: si rilancia solo il test. */
const reuseExistingServer = !CI;
const clock = `--import ${PATHS.clock}`;

/**
 * Due gruppi, nell'ordine: prima i controlli visivi (sui dati demo appena
 * scritti), poi gli smoke test, che possono cambiarli (metriche inviate,
 * account creati).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: 0,
  timeout: 60_000,
  reporter: CI
    ? [['list'], ['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],
  globalSetup: './support/global-setup.ts',
  // Le immagini di riferimento sono quelle della CI (Linux): una per pagina e dimensione.
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFileName}/{arg}{ext}',
  expect: {
    timeout: 10_000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0.002 },
  },
  use: {
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    colorScheme: 'dark',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: 'visual',
      testMatch: /\.visual\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
    {
      name: 'smoke',
      testMatch: /\.smoke\.spec\.ts$/,
      dependencies: ['visual'],
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
  ],
  webServer: [
    {
      name: 'Supabase finto',
      command: `node ${clock} ./support/fake-supabase.mjs ${PORTS.supabase}`,
      url: `${URLS.supabase}/auth/v1/.well-known/jwks.json`,
      env: { E2E_NOW: NOW },
      reuseExistingServer,
    },
    {
      name: 'Backend',
      command: `node ${clock} ${PATHS.backend}/dist/server.js`,
      url: `${URLS.api}/health`,
      env: {
        E2E_NOW: NOW,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(PORTS.api),
        LOG_LEVEL: 'warn',
        CORS_ORIGIN: `${URLS.panel},${URLS.app}`,
        DATABASE_URL,
        SUPABASE_URL: URLS.supabase,
        SUPABASE_SERVICE_ROLE_KEY: 'e2e-service-role',
        SUPABASE_STORAGE_BUCKET: 'trip-assets',
      },
      reuseExistingServer,
    },
    {
      name: 'Pannello',
      command: `node ./support/serve.mjs ${PATHS.panelBuild} ${PORTS.panel}`,
      url: URLS.panel,
      reuseExistingServer,
    },
    {
      name: 'App web',
      command: `node ./support/serve.mjs ${PATHS.appBuild} ${PORTS.app}`,
      url: URLS.app,
      reuseExistingServer,
    },
  ],
});
