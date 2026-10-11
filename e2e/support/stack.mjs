/**
 * Dove gira ogni pezzo durante gli e2e, e l'istante in cui gira: browser,
 * backend e Supabase finto vedono tutti lo stesso "adesso", così date,
 * giorni di viaggio e grafici negli screenshot sono sempre gli stessi.
 */
import { fileURLToPath } from 'node:url';

export const NOW = '2027-09-14T10:00:00.000Z';

export const PORTS = { supabase: 54321, api: 4100, panel: 5174, app: 8090 };

export const URLS = {
  supabase: `http://127.0.0.1:${PORTS.supabase}`,
  api: `http://127.0.0.1:${PORTS.api}`,
  panel: `http://localhost:${PORTS.panel}`,
  app: `http://localhost:${PORTS.app}`,
};

export const DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/app_viaggi_e2e';

/** Gli account del seed demo (`apps/backend/scripts/demo.ts`) con le loro password nel Supabase finto. */
export const ACCOUNTS = {
  staff: {
    email: 'giulia@vibemakers.test',
    password: 'staff-sicuro-1',
    id: '7f1c2a90-3d4e-4b5a-9c8d-1e2f3a4b5c6d',
  },
  coordinator: {
    email: 'sofia@example.test',
    password: 'viaggio-sicuro-1',
    id: '0b8f7c1e-5b7a-4c3e-9a51-3f6d2c1e8a01',
  },
  traveller: {
    email: 'luca@example.test',
    password: 'viaggio-sicuro-1',
    id: '1a2b3c4d-0000-4000-8000-000000000001',
  },
};

/** Il viaggio in corso del seed (Islanda): id fisso, come tutti i dati demo. */
export const ICELAND_TRIP_ID = '7e000000-0000-4000-8000-000000000001';

const here = (path) => fileURLToPath(new URL(path, import.meta.url));
export const PATHS = {
  root: here('../..'),
  backend: here('../../apps/backend'),
  admin: here('../../apps/admin'),
  mobile: here('../../apps/mobile'),
  clock: here('./clock.mjs'),
  panelBuild: here('../.build/panel'),
  appBuild: here('../.build/app'),
};
