-- Metriche d'uso (AppEvent, legati a una persona) e di prestazioni (PerfSample,
-- anonimi), mandati dall'app e dal pannello in POST /api/telemetry.

-- CreateEnum
CREATE TYPE "AppEventName" AS ENUM ('app_open', 'screen_view', 'document_open');

-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('ios', 'android', 'web');

-- CreateEnum
CREATE TYPE "TelemetrySource" AS ENUM ('app', 'panel');

-- CreateEnum
CREATE TYPE "PerfMetric" AS ENUM ('app_start', 'screen_ready', 'api_latency', 'slow_frames', 'frozen_frames', 'lcp', 'inp', 'cls', 'ttfb');

-- CreateTable
CREATE TABLE "AppEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tripId" UUID,
    "name" "AppEventName" NOT NULL,
    "screen" TEXT,
    "platform" "AppPlatform" NOT NULL,
    "appVersion" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerfSample" (
    "id" UUID NOT NULL,
    "source" "TelemetrySource" NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "appVersion" TEXT,
    "metric" "PerfMetric" NOT NULL,
    "target" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerfSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppEvent_occurredAt_idx" ON "AppEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AppEvent_userId_occurredAt_idx" ON "AppEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "AppEvent_tripId_occurredAt_idx" ON "AppEvent"("tripId", "occurredAt");

-- CreateIndex
CREATE INDEX "PerfSample_metric_occurredAt_idx" ON "PerfSample"("metric", "occurredAt");

-- AddForeignKey
ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppEvent" ADD CONSTRAINT "AppEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

