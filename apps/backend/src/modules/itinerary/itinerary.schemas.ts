import { z } from 'zod';

import { isoDateTime } from '../../lib/schemas.js';
import { DocumentDto, DocumentRefInput } from '../documents/documents.schemas.js';

export const DayParams = z.object({ tripId: z.uuid(), day: z.coerce.number().int().min(1) });
export const ActivityParams = z.object({ tripId: z.uuid(), activityId: z.uuid() });

export const StayBody = z.object({
  name: z.string().trim().min(1).max(60),
  address: z.string().trim().min(1).max(120),
  documentId: DocumentRefInput,
});

export const CreateActivityBody = z.object({
  name: z.string().trim().min(1).max(70),
  place: z.string().trim().min(1).max(120),
  documentId: DocumentRefInput,
});

export const UpdateActivityBody = z.object({
  name: z.string().trim().min(1).max(70).optional(),
  place: z.string().trim().min(1).max(120).optional(),
  /** Sposta l'attività in fondo a un altro giorno. */
  dayIndex: z.number().int().min(1).optional(),
  documentId: DocumentRefInput,
});

export const StayDto = z.object({
  name: z.string(),
  address: z.string(),
  doc: DocumentDto.nullable(),
  updatedAt: isoDateTime,
});

export const ActivityDto = z.object({
  id: z.uuid(),
  dayIndex: z.number().int(),
  name: z.string(),
  place: z.string(),
  position: z.number().int(),
  doc: DocumentDto.nullable(),
});
