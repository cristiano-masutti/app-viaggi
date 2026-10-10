import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';

import type { Document, Prisma } from '../../generated/prisma/client.js';
import { notFound } from '../../lib/errors.js';
import { removeStoredFiles } from '../../storage/cleanup.js';
import { releaseDocument, swapDocument } from '../documents/document-slots.js';
import { toDocumentDto } from '../documents/documents.schemas.js';
import { COORDINATOR_ONLY, TripParams } from '../trips/trip-access.js';
import {
  CustomsBody,
  CustomsDto,
  EmergenciesBody,
  EmergencyDto,
  InsuranceBody,
  InsuranceDto,
  TransportBody,
  TransportDto,
  TransportParams,
} from './logistics.schemas.js';

type Tx = Prisma.TransactionClient;

const withDocument = { document: true } as const;
const docOf = (slot: { document: Document | null }) => (slot.document ? toDocumentDto(slot.document) : null);

const transportInclude = {
  docs: { include: withDocument, orderBy: { position: 'asc' } },
} as const satisfies Prisma.TransportInclude;

const toTransportDto = (
  transport: Prisma.TransportGetPayload<{ include: typeof transportInclude }>,
): z.output<typeof TransportDto> => ({
  ...transport,
  docs: transport.docs.map((doc) => ({ id: doc.id, label: doc.label, doc: docOf(doc) })),
});

/**
 * Riscrive i documenti di un mezzo con l'elenco ricevuto, nell'ordine dato:
 * quelli con `id` si aggiornano, quelli senza si creano, quelli assenti si
 * cancellano (con il loro file).
 */
async function syncTransportDocs(
  tx: Tx,
  tripId: string,
  transportId: string,
  docs: z.output<typeof TransportBody>['docs'],
): Promise<string[]> {
  const existing = await tx.transportDoc.findMany({ where: { transportId } });
  const existingById = new Map(existing.map((doc) => [doc.id, doc]));
  const kept = new Set(docs.flatMap((doc) => (doc.id ? [doc.id] : [])));
  const removedPaths: string[] = [];

  for (const doc of existing.filter((item) => !kept.has(item.id))) {
    await tx.transportDoc.delete({ where: { id: doc.id } });
    removedPaths.push(...(await releaseDocument(tx, doc.documentId)));
  }

  for (const [position, input] of docs.entries()) {
    const current = input.id ? existingById.get(input.id) : undefined;
    if (input.id && !current) throw notFound('Transport document');

    const swap = await swapDocument(tx, tripId, current?.documentId ?? null, input.documentId);
    removedPaths.push(...swap.removedPaths);

    const data = { label: input.label, position, documentId: swap.documentId };
    if (current) await tx.transportDoc.update({ where: { id: current.id }, data });
    else await tx.transportDoc.create({ data: { ...data, transportId } });
  }

  return removedPaths;
}

/** Documenti fissi del viaggio: trasporti, assicurazione, dogana, card SOS. Li cura il coordinatore. */
export const logisticsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/trips/:tripId/transports',
    {
      config: COORDINATOR_ONLY,
      schema: {
        params: TripParams,
        body: TransportBody,
        response: { 201: z.object({ transport: TransportDto }) },
      },
    },
    async (request, reply) => {
      const tripId = request.trip.id;
      const { docs, ...fields } = request.body;

      const transport = await app.prisma.$transaction(async (tx) => {
        const { _max } = await tx.transport.aggregate({ where: { tripId }, _max: { position: true } });
        const created = await tx.transport.create({
          data: { ...fields, tripId, position: (_max.position ?? -1) + 1 },
        });
        await syncTransportDocs(tx, tripId, created.id, docs);
        return tx.transport.findUniqueOrThrow({ where: { id: created.id }, include: transportInclude });
      });

      return reply.status(201).send({ transport: toTransportDto(transport) });
    },
  );

  /** Sostituzione completa: nome, riferimento, mezzo ed elenco dei documenti. */
  app.put(
    '/trips/:tripId/transports/:transportId',
    {
      config: COORDINATOR_ONLY,
      schema: {
        params: TransportParams,
        body: TransportBody,
        response: { 200: z.object({ transport: TransportDto }) },
      },
    },
    async (request) => {
      const tripId = request.trip.id;
      const { docs, ...fields } = request.body;

      const { transport, removedPaths } = await app.prisma.$transaction(async (tx) => {
        const current = await tx.transport.findFirst({ where: { id: request.params.transportId, tripId } });
        if (!current) throw notFound('Transport');

        await tx.transport.update({ where: { id: current.id }, data: fields });
        const removedPaths = await syncTransportDocs(tx, tripId, current.id, docs);
        const transport = await tx.transport.findUniqueOrThrow({
          where: { id: current.id },
          include: transportInclude,
        });
        return { transport, removedPaths };
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return { transport: toTransportDto(transport) };
    },
  );

  app.delete(
    '/trips/:tripId/transports/:transportId',
    { config: COORDINATOR_ONLY, schema: { params: TransportParams } },
    async (request, reply) => {
      const removedPaths = await app.prisma.$transaction(async (tx) => {
        const transport = await tx.transport.findFirst({
          where: { id: request.params.transportId, tripId: request.trip.id },
          include: { docs: true },
        });
        if (!transport) throw notFound('Transport');

        await tx.transport.delete({ where: { id: transport.id } });
        const paths: string[] = [];
        for (const doc of transport.docs) paths.push(...(await releaseDocument(tx, doc.documentId)));
        return paths;
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return reply.status(204).send();
    },
  );

  app.put(
    '/trips/:tripId/insurance',
    {
      config: COORDINATOR_ONLY,
      schema: {
        params: TripParams,
        body: InsuranceBody,
        response: { 200: z.object({ insurance: InsuranceDto }) },
      },
    },
    async (request) => {
      const tripId = request.trip.id;
      const { documentId: requested, ...fields } = request.body;

      const { insurance, removedPaths } = await app.prisma.$transaction(async (tx) => {
        const current = await tx.insurance.findUnique({ where: { tripId } });
        const { documentId, removedPaths } = await swapDocument(
          tx,
          tripId,
          current?.documentId ?? null,
          requested,
        );
        const insurance = await tx.insurance.upsert({
          where: { tripId },
          create: { ...fields, tripId, documentId },
          update: { ...fields, documentId },
          include: withDocument,
        });
        return { insurance, removedPaths };
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return { insurance: { ...insurance, doc: docOf(insurance) } };
    },
  );

  app.delete(
    '/trips/:tripId/insurance',
    { config: COORDINATOR_ONLY, schema: { params: TripParams } },
    async (request, reply) => {
      const removedPaths = await app.prisma.$transaction(async (tx) => {
        const insurance = await tx.insurance.findUnique({ where: { tripId: request.trip.id } });
        if (!insurance) throw notFound('Insurance');
        await tx.insurance.delete({ where: { tripId: request.trip.id } });
        return releaseDocument(tx, insurance.documentId);
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return reply.status(204).send();
    },
  );

  app.put(
    '/trips/:tripId/customs',
    {
      config: COORDINATOR_ONLY,
      schema: { params: TripParams, body: CustomsBody, response: { 200: z.object({ customs: CustomsDto }) } },
    },
    async (request) => {
      const tripId = request.trip.id;
      const { documentId: requested, ...fields } = request.body;

      const { customs, removedPaths } = await app.prisma.$transaction(async (tx) => {
        const current = await tx.customs.findUnique({ where: { tripId } });
        const { documentId, removedPaths } = await swapDocument(
          tx,
          tripId,
          current?.documentId ?? null,
          requested,
        );
        const customs = await tx.customs.upsert({
          where: { tripId },
          create: { ...fields, tripId, documentId },
          update: { ...fields, documentId },
          include: withDocument,
        });
        return { customs, removedPaths };
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return { customs: { ...customs, doc: docOf(customs) } };
    },
  );

  app.delete(
    '/trips/:tripId/customs',
    { config: COORDINATOR_ONLY, schema: { params: TripParams } },
    async (request, reply) => {
      const removedPaths = await app.prisma.$transaction(async (tx) => {
        const customs = await tx.customs.findUnique({ where: { tripId: request.trip.id } });
        if (!customs) throw notFound('Customs');
        await tx.customs.delete({ where: { tripId: request.trip.id } });
        return releaseDocument(tx, customs.documentId);
      });

      await removeStoredFiles(app.storage, request.log, removedPaths);
      return reply.status(204).send();
    },
  );

  /** Le card SOS si riscrivono in blocco: l'ordine dell'elenco è l'ordine a schermo. */
  app.put(
    '/trips/:tripId/emergencies',
    {
      config: COORDINATOR_ONLY,
      schema: {
        params: TripParams,
        body: EmergenciesBody,
        response: { 200: z.object({ emergencies: z.array(EmergencyDto) }) },
      },
    },
    async (request) => {
      const tripId = request.trip.id;

      const emergencies = await app.prisma.$transaction(async (tx) => {
        await tx.emergencyContact.deleteMany({ where: { tripId } });
        await tx.emergencyContact.createMany({
          data: request.body.contacts.map((contact, position) => ({ ...contact, tripId, position })),
        });
        return tx.emergencyContact.findMany({ where: { tripId }, orderBy: { position: 'asc' } });
      });

      return { emergencies };
    },
  );
};
