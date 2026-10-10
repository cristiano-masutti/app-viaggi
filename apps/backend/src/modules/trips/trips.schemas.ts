import { z } from 'zod';

import { TripRole } from '../../generated/prisma/enums.js';
import { isoDate, isoDateTime } from '../../lib/schemas.js';

export const CreateTripBody = z
  .object({
    title: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(120),
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((trip) => trip.endDate >= trip.startDate, {
    path: ['endDate'],
    message: 'endDate must be on or after startDate',
  });

export const TripDto = z.object({
  id: z.uuid(),
  title: z.string(),
  destination: z.string(),
  startDate: isoDate,
  endDate: isoDate,
  /** Il ruolo di chi chiede: il client decide cosa mostrare come modificabile. */
  myRole: z.enum(TripRole),
  assetCount: z.number().int().nonnegative(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

export type TripDto = z.output<typeof TripDto>;
