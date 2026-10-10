import 'dotenv/config';

import { createPrismaClient } from '../src/lib/prisma.js';
import { runStaffCommand } from './staff.js';

/**
 * `npm run staff -- grant <email>`  concede il pannello di controllo
 * `npm run staff -- revoke <email>` lo toglie (effetto immediato)
 * `npm run staff -- list`           chi è staff
 */
const [command, email] = process.argv.slice(2);
if (command !== 'grant' && command !== 'revoke' && command !== 'list') {
  console.error('Uso: npm run staff -- grant <email> | revoke <email> | list');
  process.exit(1);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL mancante (vedi .env.example).');
  process.exit(1);
}

const prisma = createPrismaClient(databaseUrl);
try {
  console.log(await runStaffCommand(prisma, command, email));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
