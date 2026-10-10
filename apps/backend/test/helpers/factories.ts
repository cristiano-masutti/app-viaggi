import { randomUUID } from 'node:crypto';

import type { Prisma } from '../../src/generated/prisma/client.js';
import { TripRole } from '../../src/generated/prisma/enums.js';
import { generateInviteCode } from '../../src/modules/trips/invite-code.js';
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

type TripOverrides = Partial<Omit<Prisma.TripCreateInput, 'members'>>;

/** Viaggio di 10 giorni (14–23 settembre), sovrascrivibile campo per campo. */
export function createTrip({
  members = [],
  ...overrides
}: TripOverrides & { members?: TripMemberInput[] } = {}) {
  const title = overrides.title ?? 'Islanda On The Road 🇮🇸';
  return prisma.trip.create({
    data: {
      title,
      destination: 'Islanda',
      startDate: new Date('2026-09-14T00:00:00.000Z'),
      endDate: new Date('2026-09-23T00:00:00.000Z'),
      inviteCode: generateInviteCode(title),
      ...overrides,
      members: { create: members.map(({ user, role }) => ({ userId: user.id, role })) },
    },
  });
}

/**
 * Il cast tipico dei test di permessi: un viaggio con coordinatore e
 * viaggiatore, più un utente registrato che non ne fa parte.
 */
export async function createTripWithCrew(overrides: TripOverrides = {}) {
  const coordinator = await createUser({ firstName: 'Sofia', lastName: 'Marchi' });
  const traveller = await createUser({ firstName: 'Luca', lastName: 'Tosi' });
  const outsider = await createUser({ firstName: 'Nico', lastName: 'Pace' });
  const trip = await createTrip({
    ...overrides,
    members: [
      { user: coordinator, role: TripRole.coordinator },
      { user: traveller, role: TripRole.traveller },
    ],
  });

  return { trip, coordinator, traveller, outsider };
}

/** Documento già caricato e non ancora collegato a nessuno slot. */
export function createDocument(tripId: string, overrides: Partial<Prisma.DocumentUncheckedCreateInput> = {}) {
  return prisma.document.create({
    data: {
      tripId,
      kind: 'pdf',
      title: 'Voucher',
      originalName: 'voucher.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 24,
      storagePath: `trips/${tripId}/documents/${randomUUID()}.pdf`,
      ...overrides,
    },
  });
}

/** Ricordo già pubblicato: una nota della crew, se non si dice altro. */
export function createMemory(
  tripId: string,
  authorId: string,
  overrides: Partial<Prisma.MemoryUncheckedCreateInput> = {},
) {
  const media = overrides.kind === 'photo' || overrides.kind === 'video';
  return prisma.memory.create({
    data: {
      tripId,
      authorId,
      dayIndex: 1,
      kind: 'note',
      visibility: 'crew',
      ...(media
        ? {
            storagePath: `trips/${tripId}/memories/${randomUUID()}.jpg`,
            mimeType: 'image/jpeg',
            sizeBytes: 16,
            aspectRatio: 1.5,
          }
        : { text: 'La cascata al tramonto', mood: 'place' }),
      ...overrides,
    },
  });
}
