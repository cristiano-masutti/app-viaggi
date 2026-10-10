import { z } from 'zod';

import { MemoryVisibility, NoteMood, Reaction } from '../../generated/prisma/enums.js';
import { isoDateTime } from '../../lib/schemas.js';

export const MemoryParams = z.object({ tripId: z.uuid(), memoryId: z.uuid() });

export const ListMemoriesQuery = z.object({
  day: z.coerce.number().int().min(1).optional(),
  /** `me` oppure l'id di un compagno di viaggio. */
  author: z.union([z.literal('me'), z.uuid()]).optional(),
  kind: z.enum(['media', 'note']).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const CreateNoteBody = z.object({
  kind: z.literal('note'),
  dayIndex: z.number().int().min(1),
  visibility: z.enum(MemoryVisibility),
  text: z.string().trim().min(1).max(2000),
  mood: z.enum(NoteMood),
});

/** Campi multipart che accompagnano una foto o un video. */
export const MediaFields = z.object({
  dayIndex: z.coerce.number().int().min(1),
  visibility: z.enum(MemoryVisibility),
  caption: z.string().trim().max(300).optional(),
  /** Larghezza / altezza: la cella della griglia ha la forma giusta prima del download. */
  aspectRatio: z.coerce.number().positive().max(10).default(1),
  blurhash: z
    .string()
    .regex(/^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{6,120}$/, 'Expected a blurhash')
    .optional(),
  durationSeconds: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .optional(),
});

export const UpdateMemoryBody = z.object({
  /** Solo per le note. */
  text: z.string().trim().min(1).max(2000).optional(),
  /** Solo per foto e video; stringa vuota = togli la didascalia. */
  caption: z.string().trim().max(300).optional(),
});

export const ReactionBody = z.object({ reaction: z.enum(Reaction) });

const MemoryBase = z.object({
  id: z.uuid(),
  dayIndex: z.number().int(),
  authorId: z.uuid(),
  visibility: z.enum(MemoryVisibility),
  createdAt: isoDateTime,
});

const reactionCount = z.number().int().positive().optional();

export const ReactionsDto = z.object({
  /** Solo le reazioni presenti: `{ fire: 2, love: 1 }`. Chiavi esplicite, così i client generati le conoscono. */
  reactions: z.object({
    fire: reactionCount,
    laugh: reactionCount,
    love: reactionCount,
    mindblown: reactionCount,
  } satisfies Record<Reaction, typeof reactionCount>),
  myReaction: z.enum(Reaction).nullable(),
});

const MediaMemoryDto = MemoryBase.extend({
  kind: z.enum(['photo', 'video']),
  caption: z.string().nullable(),
  aspectRatio: z.number(),
  blurhash: z.string().nullable(),
  durationSeconds: z.number().int().nullable(),
  mimeType: z.string(),
  /**
   * URL firmato del file, valido `SIGNED_URL_TTL_SECONDS`: la griglia mostra le
   * foto senza una chiamata per ognuna. `null` se lo storage non ha risposto.
   */
  mediaUrl: z.url().nullable(),
}).extend(ReactionsDto.shape);

const NoteMemoryDto = MemoryBase.extend({
  kind: z.literal('note'),
  text: z.string(),
  mood: z.enum(NoteMood),
});

export const MemoryDto = z.discriminatedUnion('kind', [MediaMemoryDto, NoteMemoryDto]);
export type MemoryDto = z.output<typeof MemoryDto>;
