import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Document, Prisma } from '../../generated/prisma/client.js';
import { notFound } from '../../lib/errors.js';
import { removeStoredFiles } from '../../storage/cleanup.js';
import { claimDocument, releaseDocument, swapDocument } from '../documents/document-slots.js';
import { toDocumentDto } from '../documents/documents.schemas.js';
import { assertDayInTrip } from '../trips/days.js';
import { COORDINATOR_ONLY } from '../trips/trip-access.js';
import {
  ActivityDto,
  ActivityParams,
  CreateActivityBody,
  DayParams,
  StayBody,
  StayDto,
  UpdateActivityBody,
} from './itinerary.schemas.js';

const withDocument = { document: true } as const;

type WithDocument<T> = T & { document: Document | null };
const withDoc = <T>(slot: WithDocument<T>) => ({
  ...slot,
  doc: slot.document ? toDocumentDto(slot.document) : null,
});

/** Posizione in fondo alla giornata, dentro la stessa transazione dell'inserimento. */
async function nextPosition(tx: Prisma.TransactionClient, tripId: string, dayIndex: number) {
  const { _max } = await tx.activity.aggregate({ where: { tripId, dayIndex }, _max: { position: true } });
  return (_max.position ?? -1) + 1;
}

/** Programma del giorno: alloggio e attività. Lo modifica solo il coordinatore. */
export const itineraryRoutes: FastifyPluginAsyncZod = async (app) => {
  /** Crea o sostituisce l'alloggio del giorno: il placeholder e la matita portano qui. */
  app.put(
    '/trips/:tripId/days/:day/stay',
    {
      config: COORDINATOR_ONLY,
      schema: { params: DayParams, body: StayBody, response: { 200: z.object({ stay: StayDto }) } },
    },
    async (request) => {
      const { trip } = request;
      const dayIndex = request.params.day;
      assertDayInTrip(trip, dayIndex);
      const { documentId: requestedDocument, ...fields } = request.body;

      const { stay, removedPaths } = await app.prisma.$transaction(async (tx) => {
        const current = await tx.stay.findUnique({
          where: { tripId_dayIndex: { tripId: trip.id, dayIndex } },
        });
        const { documentId, removedPaths } = await swapDocument(
          tx,
          trip.id,
          current?.documentId ?? null,
          requestedDocument,
        );
        const stay = await tx.stay.upsert({
          where: { tripId_dayIndex: { tripId: trip.id, dayIndex } },
          create: { ...fields, tripId: trip.id, dayIndex, documentId },
          update: { ...fields, documentId },
          include: withDocument,
        });
        return { stay, removedPaths };
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return { stay: withDoc(stay) };
    },
  );

  app.delete(
    '/trips/:tripId/days/:day/stay',
    { config: COORDINATOR_ONLY, schema: { params: DayParams } },
    async (request, reply) => {
      const { trip } = request;
      const dayIndex = request.params.day;

      const removedPaths = await app.prisma.$transaction(async (tx) => {
        const stay = await tx.stay.findUnique({ where: { tripId_dayIndex: { tripId: trip.id, dayIndex } } });
        if (!stay) throw notFound('Stay');
        await tx.stay.delete({ where: { tripId_dayIndex: { tripId: trip.id, dayIndex } } });
        return releaseDocument(tx, stay.documentId);
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return reply.status(204).send();
    },
  );

  app.post(
    '/trips/:tripId/days/:day/activities',
    {
      config: COORDINATOR_ONLY,
      schema: {
        params: DayParams,
        body: CreateActivityBody,
        response: { 201: z.object({ activity: ActivityDto }) },
      },
    },
    async (request, reply) => {
      const { trip } = request;
      const dayIndex = request.params.day;
      assertDayInTrip(trip, dayIndex);
      const { documentId, ...fields } = request.body;

      const activity = await app.prisma.$transaction(async (tx) => {
        if (documentId) await claimDocument(tx, trip.id, documentId);
        return tx.activity.create({
          data: {
            ...fields,
            tripId: trip.id,
            dayIndex,
            position: await nextPosition(tx, trip.id, dayIndex),
            documentId: documentId ?? null,
          },
          include: withDocument,
        });
      });

      return reply.status(201).send({ activity: withDoc(activity) });
    },
  );

  app.patch(
    '/trips/:tripId/activities/:activityId',
    {
      config: COORDINATOR_ONLY,
      schema: {
        params: ActivityParams,
        body: UpdateActivityBody,
        response: { 200: z.object({ activity: ActivityDto }) },
      },
    },
    async (request) => {
      const { trip } = request;
      const { documentId: requestedDocument, dayIndex, ...fields } = request.body;
      if (dayIndex !== undefined) assertDayInTrip(trip, dayIndex);

      const { activity, removedPaths } = await app.prisma.$transaction(async (tx) => {
        const current = await tx.activity.findFirst({
          where: { id: request.params.activityId, tripId: trip.id },
        });
        if (!current) throw notFound('Activity');

        const { documentId, removedPaths } = await swapDocument(
          tx,
          trip.id,
          current.documentId,
          requestedDocument,
        );
        const moving = dayIndex !== undefined && dayIndex !== current.dayIndex;
        const activity = await tx.activity.update({
          where: { id: current.id },
          data: {
            ...fields,
            documentId,
            ...(moving ? { dayIndex, position: await nextPosition(tx, trip.id, dayIndex) } : {}),
          },
          include: withDocument,
        });
        return { activity, removedPaths };
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return { activity: withDoc(activity) };
    },
  );

  app.delete(
    '/trips/:tripId/activities/:activityId',
    { config: COORDINATOR_ONLY, schema: { params: ActivityParams } },
    async (request, reply) => {
      const removedPaths = await app.prisma.$transaction(async (tx) => {
        const activity = await tx.activity.findFirst({
          where: { id: request.params.activityId, tripId: request.trip.id },
        });
        if (!activity) throw notFound('Activity');
        await tx.activity.delete({ where: { id: activity.id } });
        return releaseDocument(tx, activity.documentId);
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return reply.status(204).send();
    },
  );
};
