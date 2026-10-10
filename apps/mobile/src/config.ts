/**
 * Da dove arrivano i dati.
 *
 * - **remote**: login con Supabase e dati dal backend (`apps/backend`). Si
 *   attiva quando ci sono tutte e tre le variabili `EXPO_PUBLIC_*` (vedi
 *   `.env.example`).
 * - **mock**: il prototipo di sempre, tutto in memoria e login finto. Resta il
 *   default senza configurazione: demo e sviluppo dell'interfaccia non hanno
 *   bisogno di un backend acceso.
 *
 * Le variabili `EXPO_PUBLIC_*` finiscono nel bundle: qui va solo ciò che è
 * pubblico per costruzione (URL e chiave publishable di Supabase), mai segreti.
 */
export interface BackendConfig {
  apiUrl: string;
  supabaseUrl: string;
  /** Chiave publishable (ex "anon"): identifica il progetto, non dà accesso ai dati. */
  supabaseKey: string;
}

// Expo sostituisce queste espressioni al momento del bundle: vanno scritte per
// esteso, non lette con un indice dinamico.
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

export const backendConfig: BackendConfig | null =
  apiUrl && supabaseUrl && supabaseKey
    ? { apiUrl: apiUrl.replace(/\/+$/, ''), supabaseUrl, supabaseKey }
    : null;

export type DataMode = 'mock' | 'remote';

export const dataMode: DataMode = backendConfig ? 'remote' : 'mock';
