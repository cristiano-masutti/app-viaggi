import type { PrismaClient } from '../src/lib/prisma.js';

/**
 * Chi è staff (pannello di controllo). Si decide solo da qui, con accesso al
 * database: l'API non ha nessuna route che conceda il ruolo.
 */
export type StaffCommand = 'grant' | 'revoke' | 'list';

export async function runStaffCommand(
  prisma: PrismaClient,
  command: StaffCommand,
  email?: string,
): Promise<string> {
  if (command === 'list') {
    const staff = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { email: true, firstName: true, lastName: true },
      orderBy: { email: 'asc' },
    });
    if (staff.length === 0) return 'Nessuno è staff.';
    return staff
      .map((user) => `${user.email ?? '(senza email)'}  ${user.firstName} ${user.lastName}`.trim())
      .join('\n');
  }

  if (!email) throw new Error(`Uso: npm run staff -- ${command} <email>`);
  const normalized = email.trim().toLowerCase();
  const { count } = await prisma.user.updateMany({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    data: { isAdmin: command === 'grant' },
  });
  if (count === 0) {
    throw new Error(
      `Nessun utente con email ${normalized}. Deve prima accedere una volta (all'app o al pannello) ` +
        'oppure essere creato dal pannello da un altro membro dello staff.',
    );
  }
  return command === 'grant' ? `${normalized} ora è staff.` : `${normalized} non è più staff.`;
}
