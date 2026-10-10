import type { Prisma } from '../../src/generated/prisma/client.js';
import { prisma } from './db.js';

/** Viaggio valido con valori di default, sovrascrivibili campo per campo. */
export function createTrip(overrides: Partial<Prisma.TripCreateInput> = {}) {
  return prisma.trip.create({
    data: {
      title: 'Islanda On The Road 🇮🇸',
      destination: 'Islanda',
      startDate: new Date('2026-09-14T00:00:00.000Z'),
      endDate: new Date('2026-09-23T00:00:00.000Z'),
      ...overrides,
    },
  });
}
