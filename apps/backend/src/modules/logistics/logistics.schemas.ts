import { z } from 'zod';

import { TransportMode } from '../../generated/prisma/enums.js';
import { DocumentDto, DocumentRefInput } from '../documents/documents.schemas.js';

/** Numero già pronto per `tel:`: cifre, al più un '+' iniziale. */
export const PhoneNumber = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s().-]/g, ''))
  .pipe(z.string().regex(/^\+?[0-9]{2,20}$/, 'Expected a phone number'));

export const TransportParams = z.object({ tripId: z.uuid(), transportId: z.uuid() });

const TransportDocInput = z.object({
  /** Presente = documento esistente da aggiornare; assente = nuovo. */
  id: z.uuid().optional(),
  label: z.string().trim().min(1).max(40),
  documentId: DocumentRefInput,
});

export const TransportBody = z.object({
  name: z.string().trim().min(1).max(60),
  reference: z.string().trim().max(120).default(''),
  mode: z.enum(TransportMode),
  /** Elenco completo e ordinato: i documenti non elencati vengono rimossi. */
  docs: z
    .array(TransportDocInput)
    .max(10)
    .default([])
    .refine(
      (docs) => {
        const ids = docs.flatMap((doc) => (doc.id ? [doc.id] : []));
        return new Set(ids).size === ids.length;
      },
      { message: 'Each document id can appear only once' },
    ),
});

export const InsuranceBody = z.object({
  company: z.string().trim().min(1).max(50),
  policy: z.string().trim().min(1).max(24),
  coverage: z.string().trim().max(50).default(''),
  emergencyPhone: z.union([z.literal(''), PhoneNumber]).default(''),
  documentId: DocumentRefInput,
});

export const CustomsBody = z.object({
  code: z.string().trim().min(1).max(24),
  note: z.string().trim().max(80).default(''),
  documentId: DocumentRefInput,
});

export const EmergencyInput = z.object({
  title: z.string().trim().min(1).max(80),
  subtitle: z.string().trim().max(160).default(''),
  actionLabel: z.string().trim().min(1).max(60),
  phone: PhoneNumber,
  whatsapp: z.boolean().default(false),
});

export const EmergenciesBody = z.object({ contacts: z.array(EmergencyInput).max(10) });

export const TransportDto = z.object({
  id: z.uuid(),
  name: z.string(),
  reference: z.string(),
  mode: z.enum(TransportMode),
  docs: z.array(z.object({ id: z.uuid(), label: z.string(), doc: DocumentDto.nullable() })),
});

export const InsuranceDto = z.object({
  company: z.string(),
  policy: z.string(),
  coverage: z.string(),
  emergencyPhone: z.string(),
  doc: DocumentDto.nullable(),
});

export const CustomsDto = z.object({
  code: z.string(),
  note: z.string(),
  doc: DocumentDto.nullable(),
});

export const EmergencyDto = z.object({
  id: z.uuid(),
  title: z.string(),
  subtitle: z.string(),
  actionLabel: z.string(),
  phone: z.string(),
  whatsapp: z.boolean(),
});
