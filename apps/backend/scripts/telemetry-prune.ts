import 'dotenv/config';

import { createPrismaClient } from '../src/lib/prisma.js';
import { DEFAULT_RETENTION_DAYS, pruneTelemetry } from './telemetry.js';

/**
 * `npm run telemetry:prune`           tiene gli ultimi 180 giorni
 * `npm run telemetry:prune -- 90`     tiene gli ultimi 90
 * Da pianificare una volta al giorno (cron della piattaforma di deploy).
 */
const days = process.argv[2] ? Number(process.argv[2]) : DEFAULT_RETENTION_DAYS;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL mancante (vedi .env.example).');
  process.exit(1);
}

const prisma = createPrismaClient(databaseUrl);
try {
  const { events, samples, before } = await pruneTelemetry(prisma, days);
  console.log(
    `Cancellati ${events} eventi e ${samples} campioni precedenti al ${before.toISOString().slice(0, 10)}.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
