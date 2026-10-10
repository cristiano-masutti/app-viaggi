import type { Prisma } from '../../src/generated/prisma/client.js';
import { TripRole } from '../../src/generated/prisma/enums.js';
import { newAuthUser } from './auth.js';
import { prisma } from './db.js';

/** Utente già presente nel database, come dopo la sua prima richiesta autenticata. */
export function createUser(overrides: Partial<Prisma.UserCreateInput> = {}) {
  return prisma.user.create({ data: { ...newAuthUser(), ...overrides } });
}

interface TripMemberInput {
  user: { id: string };
  role: TripRole;
}

/** Viaggio valido con valori di default, sovrascrivibili campo per campo. */
export function createTrip({
  members = [],
  ...overrides
}: Partial<Omit<Prisma.TripCreateInput, 'members'>> & { members?: TripMemberInput[] } = {}) {
  return prisma.trip.create({
    data: {
      title: 'Islanda On The Road 🇮🇸',
      destination: 'Islanda',
      startDate: new Date('2026-09-14T00:00:00.000Z'),
      endDate: new Date('2026-09-23T00:00:00.000Z'),
      ...overrides,
      members: { create: members.map(({ user, role }) => ({ userId: user.id, role })) },
    },
  });
}

/**
 * Il cast tipico dei test di permessi: un viaggio con coordinatore e
 * viaggiatore, più un utente registrato che non ne fa parte.
 */
export async function createTripWithCrew(overrides: Partial<Omit<Prisma.TripCreateInput, 'members'>> = {}) {
  const coordinator = await createUser();
  const traveller = await createUser();
  const outsider = await createUser();
  const trip = await createTrip({
    ...overrides,
    members: [
      { user: coordinator, role: TripRole.COORDINATOR },
      { user: traveller, role: TripRole.TRAVELLER },
    ],
  });

  return { trip, coordinator, traveller, outsider };
}
