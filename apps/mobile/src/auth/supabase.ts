import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';

import { backendConfig } from '@/config';

import { sessionStorage } from './sessionStorage';

/**
 * Il client Supabase, uno solo per tutta l'app (più istanze si contenderebbero
 * la stessa sessione). In modalità mock non esiste.
 *
 * Serve solo per il login: i dati passano dal backend, che verifica il token.
 */
export const supabase = backendConfig
  ? createClient(backendConfig.supabaseUrl, backendConfig.supabaseKey, {
      auth: {
        storage: sessionStorage,
        persistSession: true,
        autoRefreshToken: true,
        // Niente redirect OAuth da intercettare: il login è email e password.
        detectSessionInUrl: false,
      },
    })
  : null;
