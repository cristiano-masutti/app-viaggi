/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // '/src' per Vite è la cartella src del progetto, su ogni sistema operativo.
  resolve: { alias: { '@': '/src' } },
  server: { port: 5173 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // Le date del pannello sono quelle di chi lo usa: in Italia.
    env: { TZ: 'Europe/Rome' },
  },
});
