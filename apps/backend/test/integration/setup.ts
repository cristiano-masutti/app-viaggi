import { afterAll, beforeEach } from 'vitest';

import { prisma, resetDatabase } from '../helpers/db.js';

// Ogni test parte da un database vuoto: nessun test dipende da quelli prima.
beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
