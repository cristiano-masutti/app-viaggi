import crypto from "node:crypto";
import path from "node:path";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { supabaseAdmin } from "../lib/supabase.js";

const UploadQuerySchema = z.object({
  tripId: z.string().uuid(),
});

const SignedUrlParamsSchema = z.object({
  assetId: z.string().uuid(),
});

const createPublicUrl = (storagePath: string) =>
  `${env.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/${storagePath}`;

export const uploadRoutes: FastifyPluginAsync = async (app) => {
  app.post("/uploads", async (request, reply) => {
    const parsedQuery = UploadQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      return reply.status(400).send({
        error: "Invalid query params",
        details: parsedQuery.error.flatten(),
      });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: parsedQuery.data.tripId },
      select: { id: true },
    });
    if (!trip) {
      return reply.status(404).send({ error: "Trip not found" });
    }

    const file = await request.file();
    if (!file) {
      return reply.status(400).send({ error: "Multipart file is required" });
    }

    const extension = path.extname(file.filename || "").toLowerCase();
    const safeExtension =
      extension.length > 0 && extension.length <= 10 ? extension : "";
    const fileName = `${crypto.randomUUID()}${safeExtension}`;
    const storagePath = `trips/${trip.id}/${fileName}`;
    const bytes = await file.toBuffer();

    const uploadResult = await supabaseAdmin.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (uploadResult.error) {
      app.log.error(uploadResult.error, "Failed to upload file to Supabase");
      return reply.status(502).send({
        error: "Storage upload failed",
        details: uploadResult.error.message,
      });
    }

    const asset = await prisma.tripAsset.create({
      data: {
        tripId: trip.id,
        originalName: file.filename || fileName,
        mimeType: file.mimetype,
        storagePath,
        publicUrl: createPublicUrl(storagePath),
      },
    });

    return reply.status(201).send({ asset });
  });

  app.get("/uploads/:assetId/signed-url", async (request, reply) => {
    const parsedParams = SignedUrlParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(400).send({
        error: "Invalid params",
        details: parsedParams.error.flatten(),
      });
    }

    const asset = await prisma.tripAsset.findUnique({
      where: { id: parsedParams.data.assetId },
      select: { storagePath: true, id: true },
    });

    if (!asset) {
      return reply.status(404).send({ error: "Asset not found" });
    }

    const signedResult = await supabaseAdmin.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(asset.storagePath, 60 * 15);

    if (signedResult.error) {
      app.log.error(signedResult.error, "Failed to create signed URL");
      return reply.status(502).send({
        error: "Signed URL generation failed",
        details: signedResult.error.message,
      });
    }

    return reply.send({
      assetId: asset.id,
      signedUrl: signedResult.data.signedUrl,
      expiresInSeconds: 60 * 15,
    });
  });
};
