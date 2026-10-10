import dotenv from 'dotenv';
import { defineConfig } from 'vitest/config';

// Carica `.env.test` senza sovrascrivere l'ambiente: in CI DATABASE_URL arriva
// dal workflow. I worker dei test ereditano `process.env` da qui.
dotenv.config({ path: '.env.test', quiet: true });

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['test/unit/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'integration',
          include: ['test/integration/**/*.test.ts'],
          globalSetup: ['test/integration/global-setup.ts'],
          setupFiles: ['test/integration/setup.ts'],
          // Un solo database di test, svuotato prima di ogni test: i file
          // girano uno alla volta per non pestarsi i dati a vicenda.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/server.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
