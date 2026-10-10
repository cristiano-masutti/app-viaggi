/**
 * Dove sta il backend e quale progetto Supabase usare (vedi `.env.example`).
 * Il pannello non ha una modalità prototipo: senza configurazione lo dice e
 * si ferma, invece di mostrare dati finti a chi deve prendere decisioni vere.
 */
export interface AdminConfig {
  apiUrl: string;
  supabaseUrl: string;
  /** Chiave publishable: identifica il progetto, non dà accesso ai dati. */
  supabaseKey: string;
}

function readConfig(env: ImportMetaEnv): AdminConfig | null {
  const { VITE_API_URL: apiUrl, VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_KEY: supabaseKey } = env;
  if (!apiUrl || !supabaseUrl || !supabaseKey) return null;
  return { apiUrl: apiUrl.replace(/\/+$/, ''), supabaseUrl, supabaseKey };
}

export const config = readConfig(import.meta.env);
