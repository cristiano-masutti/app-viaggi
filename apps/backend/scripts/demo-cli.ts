import 'dotenv/config';

import { createPrismaClient } from '../src/lib/prisma.js';
import { clearDemoData, demoDatabaseName, seedDemo } from './demo.js';

/**
 * `npm run seed:demo` riempie il database con i dati dimostrativi.
 *
 * Svuota tutte le tabelle prima di scrivere: per questo parte solo su un
 * database il cui nome contiene `demo` o `e2e` (es. `app_viaggi_e2e`), mai su
 * quello di sviluppo o di produzione. L'istante di riferimento è adesso, o
 * `DEMO_NOW` (es. `2027-09-14T10:00:00Z`) per dati sempre uguali.
 */
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL mancante (vedi .env.example).');
  process.exit(1);
}

let database: string;
try {
  database = demoDatabaseName(databaseUrl);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const now = process.env.DEMO_NOW ? new Date(process.env.DEMO_NOW) : new Date();
if (Number.isNaN(now.getTime())) {
  console.error(`DEMO_NOW non è un istante valido: ${process.env.DEMO_NOW}`);
  process.exit(1);
}

const prisma = createPrismaClient(databaseUrl);
try {
  await clearDemoData(prisma);
  const summary = await seedDemo(prisma, now);
  console.log(
    `Dati demo in "${database}" al ${now.toISOString()}: ${summary.people} persone, ${summary.trips} viaggi, ` +
      `${summary.events} eventi d'uso, ${summary.samples} misure di prestazioni.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
