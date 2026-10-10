import { describe, expect, it } from 'vitest';

import { runStaffCommand } from '../../scripts/staff.js';
import { prisma } from '../helpers/db.js';
import { createUser } from '../helpers/factories.js';

describe('npm run staff', () => {
  it('grants and revokes the control panel by email, whatever the case', async () => {
    const user = await createUser({ email: 'giulia@example.test', firstName: 'Giulia', lastName: 'Rossi' });

    expect(await runStaffCommand(prisma, 'grant', ' Giulia@Example.TEST ')).toBe(
      'giulia@example.test ora è staff.',
    );
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ isAdmin: true });
    expect(await runStaffCommand(prisma, 'list')).toBe('giulia@example.test  Giulia Rossi');

    await runStaffCommand(prisma, 'revoke', 'giulia@example.test');
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ isAdmin: false });
    expect(await runStaffCommand(prisma, 'list')).toBe('Nessuno è staff.');
  });

  it('explains what to do when the person has never signed in', async () => {
    await expect(runStaffCommand(prisma, 'grant', 'nessuno@example.test')).rejects.toThrow(
      /accedere una volta/,
    );
    await expect(runStaffCommand(prisma, 'grant')).rejects.toThrow(/Uso/);
  });
});
