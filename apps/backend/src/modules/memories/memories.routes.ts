import crypto from 'node:crypto';

import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Memory, Prisma, PrismaClient } from '../../generated/prisma/client.js';
import { MemoryKind, MemoryVisibility, NoteMood, type Reaction } from '../../generated/prisma/enums.js';
import { AppError, badRequest, forbidden, notFound } from '../../lib/errors.js';
import { extensionFor, MEDIA_FILE_TYPES } from '../../lib/file-types.js';
import { readUpload, requireFile } from '../../lib/multipart.js';
import { decodeCursor, encodeCursor } from '../../lib/pagination.js';
import { parseOrThrow } from '../../lib/validation.js';
import { removeStoredFiles } from '../../storage/cleanup.js';
import { SignedUrlDto } from '../documents/documents.schemas.js';
import { assertDayInTrip } from '../trips/days.js';
import { TripParams } from '../trips/trip-access.js';
import { lockTrip } from '../trips/trip-lock.js';
import {
  CreateNoteBody,
  ListMemoriesQuery,
  MediaFields,
  MemoryDto,
  MemoryParams,
  ReactionBody,
  ReactionsDto,
  UpdateMemoryBody,
} from './memories.schemas.js';

/** Un ricordo è visibile alla crew, oppure solo al suo autore se è privato. */
const visibleTo = (userId: string): Prisma.MemoryWhereInput => ({
  OR: [{ visibility: MemoryVisibility.crew }, { authorId: userId }],
});

/** 404 per un ricordo inesistente come per uno privato di qualcun altro. */
async function findVisibleMemory(prisma: PrismaClient, tripId: string, memoryId: string, userId: string) {
  const memory = await prisma.memory.findFirst({ where: { id: memoryId, tripId, ...visibleTo(userId) } });
  if (!memory) throw notFound('Memory');
  return memory;
}

/** Contatori per reazione e reazione di chi chiede, per un gruppo di ricordi. */
async function loadReactions(prisma: PrismaClient, memoryIds: string[], userId: string) {
  const [counts, mine] = await Promise.all([
    prisma.memoryReaction.groupBy({
      by: ['memoryId', 'reaction'],
      where: { memoryId: { in: memoryIds } },
      _count: { _all: true },
    }),
    prisma.memoryReaction.findMany({ where: { memoryId: { in: memoryIds }, userId } }),
  ]);

  const byMemory = new Map<string, z.output<typeof ReactionsDto>>(
    memoryIds.map((id) => [id, { reactions: {}, myReaction: null }]),
  );
  for (const { memoryId, reaction, _count } of counts)
    byMemory.get(memoryId)!.reactions[reaction] = _count._all;
  for (const { memoryId, reaction } of mine) byMemory.get(memoryId)!.myReaction = reaction;
  return byMemory;
}

/**
 * URL firmati per le foto e i video di una pagina, con una sola chiamata allo
 * storage. Se lo storage non risponde la pagina arriva lo stesso, senza URL:
 * note, didascalie e reazioni restano leggibili.
 */
async function signMedia(
  app: FastifyInstance,
  log: FastifyBaseLogger,
  memories: Memory[],
): Promise<Map<string, string>> {
  const paths = memories.flatMap((memory) => (memory.storagePath ? [memory.storagePath] : []));
  if (paths.length === 0) return new Map();
  try {
    return await app.storage.createSignedUrls(paths, app.config.SIGNED_URL_TTL_SECONDS);
  } catch (error) {
    log.error({ err: error }, 'Could not sign memory media URLs');
    return new Map();
  }
}

function toMemoryDto(
  memory: Memory,
  reactions: z.output<typeof ReactionsDto>,
  mediaUrls: Map<string, string>,
): MemoryDto {
  const base = {
    id: memory.id,
    dayIndex: memory.dayIndex,
    authorId: memory.authorId,
    visibility: memory.visibility,
    createdAt: memory.createdAt,
  };

  if (memory.kind === MemoryKind.note) {
    return { ...base, kind: MemoryKind.note, text: memory.text ?? '', mood: memory.mood ?? NoteMood.thought };
  }

  return {
    ...base,
    kind: memory.kind,
    caption: memory.caption,
    aspectRatio: memory.aspectRatio ?? 1,
    blurhash: memory.blurhash,
    durationSeconds: memory.durationSeconds,
    mimeType: memory.mimeType ?? 'application/octet-stream',
    mediaUrl: (memory.storagePath && mediaUrls.get(memory.storagePath)) ?? null,
    ...reactions,
  };
}

const noReactions = (): z.output<typeof ReactionsDto> => ({ reactions: {}, myReaction: null });

const authorOnly = (memory: Memory, userId: string) => {
  if (memory.authorId !== userId) throw forbidden('Only the author can change this memory');
};

/** Ricordi del viaggio: li pubblica ogni membro, li modifica solo chi li ha pubblicati. */
export const memoryRoutes: FastifyPluginAsyncZod = async (app) => {
  /** A pagine, dal più recente. `nextCursor` è `null` all'ultima pagina. */
  app.get(
    '/trips/:tripId/memories',
    {
      schema: {
        params: TripParams,
        querystring: ListMemoriesQuery,
        response: { 200: z.object({ memories: z.array(MemoryDto), nextCursor: z.string().nullable() }) },
      },
    },
    async (request) => {
      const userId = request.user.id;
      const { day, author, kind, cursor, limit } = request.query;
      const after = cursor ? decodeCursor(cursor) : null;

      const filters: Prisma.MemoryWhereInput[] = [{ tripId: request.trip.id }, visibleTo(userId)];
      if (day !== undefined) filters.push({ dayIndex: day });
      if (author !== undefined) filters.push({ authorId: author === 'me' ? userId : author });
      if (kind === 'note') filters.push({ kind: MemoryKind.note });
      if (kind === 'media') filters.push({ kind: { in: [MemoryKind.photo, MemoryKind.video] } });
      if (after) {
        filters.push({
          OR: [{ createdAt: { lt: after.createdAt } }, { createdAt: after.createdAt, id: { lt: after.id } }],
        });
      }

      const page = await app.prisma.memory.findMany({
        where: { AND: filters },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      });
      const memories = page.slice(0, limit);
      const last = memories.at(-1);
      const [reactions, mediaUrls] = await Promise.all([
        loadReactions(
          app.prisma,
          memories.map((memory) => memory.id),
          userId,
        ),
        signMedia(app, request.log, memories),
      ]);

      return {
        memories: memories.map((memory) =>
          toMemoryDto(memory, reactions.get(memory.id) ?? noReactions(), mediaUrls),
        ),
        nextCursor: page.length > limit && last ? encodeCursor(last) : null,
      };
    },
  );

  /**
   * Una nota arriva come JSON; una foto o un video come multipart, con i
   * metadati nei campi e il file nel campo `file`.
   */
  app.post(
    '/trips/:tripId/memories',
    { schema: { params: TripParams, response: { 201: z.object({ memory: MemoryDto }) } } },
    async (request, reply) => {
      const { trip } = request;
      const authorId = request.user.id;

      if (!request.isMultipart()) {
        const note = parseOrThrow(CreateNoteBody, request.body, 'body');

        const memory = await app.prisma.$transaction(async (tx) => {
          // Il giorno si verifica sotto lock: le date non cambiano finché scriviamo.
          assertDayInTrip(await lockTrip(tx, trip.id, 'share'), note.dayIndex);
          return tx.memory.create({
            data: {
              tripId: trip.id,
              authorId,
              dayIndex: note.dayIndex,
              kind: MemoryKind.note,
              visibility: note.visibility,
              text: note.text,
              // Una nota privata è sempre "Personale", qualunque etichetta fosse scelta.
              mood: note.visibility === MemoryVisibility.private ? NoteMood.personal : note.mood,
            },
          });
        });
        return reply.status(201).send({ memory: toMemoryDto(memory, noReactions(), new Map()) });
      }

      const upload = await readUpload(request, { accept: MEDIA_FILE_TYPES });
      const file = requireFile(upload);
      const fields = parseOrThrow(MediaFields, upload.fields, 'fields');
      assertDayInTrip(trip, fields.dayIndex);

      const storagePath = `trips/${trip.id}/memories/${crypto.randomUUID()}.${extensionFor(file.type)}`;
      await app.storage.upload(storagePath, file.bytes, file.type);

      try {
        const memory = await app.prisma.$transaction(async (tx) => {
          assertDayInTrip(await lockTrip(tx, trip.id, 'share'), fields.dayIndex);
          return tx.memory.create({
            data: {
              ...fields,
              tripId: trip.id,
              authorId,
              kind: file.type.startsWith('video/') ? MemoryKind.video : MemoryKind.photo,
              storagePath,
              mimeType: file.type,
              sizeBytes: file.bytes.length,
            },
          });
        });
        const mediaUrls = await signMedia(app, request.log, [memory]);
        return reply.status(201).send({ memory: toMemoryDto(memory, noReactions(), mediaUrls) });
      } catch (error) {
        await removeStoredFiles(app.storage, request.log, [storagePath]);
        throw error;
      }
    },
  );

  /** Correzione del testo di una nota o della didascalia di una foto. */
  app.patch(
    '/trips/:tripId/memories/:memoryId',
    {
      schema: {
        params: MemoryParams,
        body: UpdateMemoryBody,
        response: { 200: z.object({ memory: MemoryDto }) },
      },
    },
    async (request) => {
      const userId = request.user.id;
      const memory = await findVisibleMemory(app.prisma, request.trip.id, request.params.memoryId, userId);
      authorOnly(memory, userId);

      const { text, caption } = request.body;
      const isNote = memory.kind === MemoryKind.note;
      if ((isNote && caption !== undefined) || (!isNote && text !== undefined)) {
        throw badRequest(
          'WRONG_MEMORY_FIELD',
          isNote ? 'A note has text, not a caption' : 'Only notes have text',
        );
      }

      const updated = await app.prisma.memory.update({
        where: { id: memory.id },
        data: isNote ? { text } : { caption: caption === '' ? null : caption },
      });
      const [reactions, mediaUrls] = await Promise.all([
        loadReactions(app.prisma, [memory.id], userId),
        signMedia(app, request.log, [updated]),
      ]);
      return { memory: toMemoryDto(updated, reactions.get(memory.id) ?? noReactions(), mediaUrls) };
    },
  );

  app.delete(
    '/trips/:tripId/memories/:memoryId',
    { schema: { params: MemoryParams } },
    async (request, reply) => {
      const memory = await findVisibleMemory(
        app.prisma,
        request.trip.id,
        request.params.memoryId,
        request.user.id,
      );
      authorOnly(memory, request.user.id);

      await app.prisma.memory.delete({ where: { id: memory.id } });
      await removeStoredFiles(app.storage, request.log, [memory.storagePath]);
      return reply.status(204).send();
    },
  );

  /** Una reazione per persona: quella nuova sostituisce la precedente. */
  app.put(
    '/trips/:tripId/memories/:memoryId/reaction',
    { schema: { params: MemoryParams, body: ReactionBody, response: { 200: ReactionsDto } } },
    async (request) => {
      const userId = request.user.id;
      const memory = await findVisibleMemory(app.prisma, request.trip.id, request.params.memoryId, userId);
      if (memory.kind === MemoryKind.note) {
        throw new AppError(409, 'NOT_REACTABLE', 'Notes do not take reactions');
      }

      const reaction: Reaction = request.body.reaction;
      await app.prisma.memoryReaction.upsert({
        where: { memoryId_userId: { memoryId: memory.id, userId } },
        create: { memoryId: memory.id, userId, reaction },
        update: { reaction },
      });

      return (await loadReactions(app.prisma, [memory.id], userId)).get(memory.id) ?? noReactions();
    },
  );

  app.delete(
    '/trips/:tripId/memories/:memoryId/reaction',
    { schema: { params: MemoryParams, response: { 200: ReactionsDto } } },
    async (request) => {
      const userId = request.user.id;
      const memory = await findVisibleMemory(app.prisma, request.trip.id, request.params.memoryId, userId);

      await app.prisma.memoryReaction.deleteMany({ where: { memoryId: memory.id, userId } });
      return (await loadReactions(app.prisma, [memory.id], userId)).get(memory.id) ?? noReactions();
    },
  );

  app.get(
    '/trips/:tripId/memories/:memoryId/media-url',
    { schema: { params: MemoryParams, response: { 200: SignedUrlDto } } },
    async (request) => {
      const memory = await findVisibleMemory(
        app.prisma,
        request.trip.id,
        request.params.memoryId,
        request.user.id,
      );
      if (!memory.storagePath) throw notFound('Memory media');

      const expiresInSeconds = app.config.SIGNED_URL_TTL_SECONDS;
      const url = await app.storage.createSignedUrl(memory.storagePath, expiresInSeconds);
      return { url, expiresInSeconds };
    },
  );
};
