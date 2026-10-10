import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/', 'src/api/schema.d.ts', 'tailwind.config.js'] },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  reactHooks.configs.flat.recommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // onClick={() => mutate()} è il modo normale di scrivere un handler React.
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
    },
  },
  {
    // Nei test i finti (fetch, Supabase) sono async per contratto, anche senza await.
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },
  { files: ['**/*.js'], extends: [tseslint.configs.disableTypeChecked] },
);
