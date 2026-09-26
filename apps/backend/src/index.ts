import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.js";
import { tripRoutes } from "./routes/trips.js";
import { uploadRoutes } from "./routes/uploads.js";
import { prisma } from "./lib/prisma.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: env.CORS_ORIGIN,
});

await app.register(multipart, {
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
});

await app.register(healthRoutes);
await app.register(tripRoutes, { prefix: "/api" });
await app.register(uploadRoutes, { prefix: "/api" });

const start = async () => {
  try {
    await app.listen({
      host: "0.0.0.0",
      port: env.PORT,
    });
  } catch (error) {
    app.log.error(error, "Failed to start backend");
    process.exit(1);
  }
};

const shutdown = async () => {
  await app.close();
  await prisma.$disconnect();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await start();
