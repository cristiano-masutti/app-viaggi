import { createClient } from '@supabase/supabase-js';

import type { AdminConfig } from '@/config';

/**
 * Sessione nel `localStorage` di questo browser, sotto una chiave sua: non si
 * mescola con altre app Supabase aperte sullo stesso dominio.
 */
export const createSupabase = (config: AdminConfig) =>
  createClient(config.supabaseUrl, config.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: 'vibemakers.admin.auth',
    },
  });
