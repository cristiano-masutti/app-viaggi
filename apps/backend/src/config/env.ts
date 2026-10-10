import { z } from 'zod';

/**
 * Configurazione dell'API, validata una volta sola all'avvio.
 *
 * `loadConfig` è una funzione pura sull'oggetto che riceve: il server le passa
 * `process.env`, i test un oggetto scritto a mano. Nessun modulo legge
 * `process.env` per conto suo, così una variabile mancante si scopre al boot e
 * non alla prima richiesta che la usa.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Origini ammesse separate da virgola. Le app native non mandano Origin: serve solo al web. */
  CORS_ORIGIN: z
    .string()
    .min(1)
    .default('http://localhost:8081')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.url(),
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('trip-assets'),
  UPLOAD_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 1024 * 1024),
  SIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
});

export type AppConfig = z.infer<typeof EnvSchema>;

export function loadConfig(source: Record<string, string | undefined>): AppConfig {
  const parsed = EnvSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Invalid backend environment configuration: ${issues}`);
  }

  return parsed.data;
}
