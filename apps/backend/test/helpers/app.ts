import { afterEach } from 'vitest';

import { type AppDeps, buildApp } from '../../src/app.js';
import { type AppConfig, loadConfig } from '../../src/config/env.js';
import { testTokenVerifier } from './auth.js';
import { prisma } from './db.js';
import { InMemoryStorage } from './memory-storage.js';

export const testConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  ...loadConfig(process.env),
  ...overrides,
});

const openApps: Array<{ close: () => Promise<unknown> }> = [];

afterEach(async () => {
  await Promise.all(openApps.splice(0).map((app) => app.close()));
});

/**
 * Un'istanza dell'API pronta per `app.inject()`, cablata sul database di test,
 * su uno storage in memoria e sulle chiavi di firma di `auth.ts`. Si chiude da
 * sola alla fine del test.
 */
export async function createTestApp(
  overrides: {
    config?: Partial<AppConfig>;
    prisma?: AppDeps['prisma'];
    storage?: InMemoryStorage;
    tokenVerifier?: AppDeps['tokenVerifier'];
  } = {},
) {
  const storage = overrides.storage ?? new InMemoryStorage();
  const routes: Array<{ method: string; url: string }> = [];
  const app = await buildApp(
    {
      config: testConfig(overrides.config),
      prisma: overrides.prisma ?? prisma,
      storage,
      tokenVerifier: overrides.tokenVerifier ?? testTokenVerifier,
    },
    {
      logger: false,
      onRoute: ({ method, url }) => {
        for (const verb of [method].flat()) {
          // HEAD e OPTIONS sono generate da Fastify e dal plugin CORS.
          if (verb !== 'HEAD' && verb !== 'OPTIONS') routes.push({ method: verb, url });
        }
      },
    },
  );
  await app.ready();
  openApps.push(app);

  return { app, storage, routes };
}
