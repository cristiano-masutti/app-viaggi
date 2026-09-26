import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";

const CreateTripBodySchema = z
  .object({
    title: z.string().trim().min(2).max(120),
    destination: z.string().trim().min(2).max(120),
    startDate: z.iso.datetime(),
    endDate: z.iso.datetime(),
  })
  .superRefine((value, ctx) => {
    if (new Date(value.endDate) < new Date(value.startDate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "endDate must be after startDate",
      });
    }
  });

export const tripRoutes: FastifyPluginAsync = async (app) => {
  app.get("/trips", async (_request, reply) => {
    const trips = await prisma.trip.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { assets: true },
        },
      },
    });
    return reply.send({ trips });
  });

  app.post("/trips", async (request, reply) => {
    const parsedBody = CreateTripBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.status(400).send({
        error: "Invalid payload",
        details: parsedBody.error.flatten(),
      });
    }

    const trip = await prisma.trip.create({
      data: {
        title: parsedBody.data.title,
        destination: parsedBody.data.destination,
        startDate: new Date(parsedBody.data.startDate),
        endDate: new Date(parsedBody.data.endDate),
      },
    });

    return reply.status(201).send({ trip });
  });
};
