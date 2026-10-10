-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('pdf', 'image', 'qr');

-- CreateEnum
CREATE TYPE "TransportMode" AS ENUM ('van', 'flight', 'ferry');

-- CreateEnum
CREATE TYPE "MemoryKind" AS ENUM ('photo', 'video', 'note');

-- CreateEnum
CREATE TYPE "MemoryVisibility" AS ENUM ('crew', 'private');

-- CreateEnum
CREATE TYPE "NoteMood" AS ENUM ('anecdote', 'place', 'thought', 'personal');

-- CreateEnum
CREATE TYPE "Reaction" AS ENUM ('fire', 'laugh', 'love', 'mindblown');

-- AlterEnum: valori in minuscolo come nel modello del mobile. RENAME VALUE
-- conserva le righe esistenti (ricreare il tipo fallirebbe sul cast).
ALTER TYPE "TripRole" RENAME VALUE 'COORDINATOR' TO 'coordinator';
ALTER TYPE "TripRole" RENAME VALUE 'TRAVELLER' TO 'traveller';

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "crewCapacity" INTEGER,
ADD COLUMN     "inviteCode" TEXT,
ALTER COLUMN "destination" DROP NOT NULL;
-- I viaggi già esistenti ricevono un codice casuale (64 bit) prima del NOT NULL.
UPDATE "Trip" SET "inviteCode" = substr(md5(random()::text || "id"::text), 1, 16) WHERE "inviteCode" IS NULL;
ALTER TABLE "Trip" ALTER COLUMN "inviteCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "diet" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "fiscalCode" TEXT,
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "medicalNotes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "passportExpiry" TEXT,
ADD COLUMN     "passportNumber" TEXT,
ADD COLUMN     "passportPhotoPath" TEXT,
ADD COLUMN     "username" TEXT;

-- TripAsset diventa Document: rinomina e completa la tabella esistente,
-- così i file già caricati restano raggiungibili.
ALTER TABLE "TripAsset" RENAME TO "Document";
ALTER TABLE "Document" RENAME CONSTRAINT "TripAsset_pkey" TO "Document_pkey";
ALTER TABLE "Document" RENAME CONSTRAINT "TripAsset_tripId_fkey" TO "Document_tripId_fkey";
ALTER TABLE "Document" RENAME CONSTRAINT "TripAsset_uploadedById_fkey" TO "Document_uploadedById_fkey";
ALTER INDEX "TripAsset_storagePath_key" RENAME TO "Document_storagePath_key";
ALTER INDEX "TripAsset_tripId_idx" RENAME TO "Document_tripId_idx";
ALTER TABLE "Document" ADD COLUMN "kind" "DocumentKind",
ADD COLUMN "title" TEXT,
ADD COLUMN "subtitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN "code" TEXT NOT NULL DEFAULT '',
ADD COLUMN "attached" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "originalName" DROP NOT NULL,
ALTER COLUMN "mimeType" DROP NOT NULL,
ALTER COLUMN "sizeBytes" DROP NOT NULL,
ALTER COLUMN "storagePath" DROP NOT NULL;
UPDATE "Document" SET
  "kind" = CASE WHEN "mimeType" = 'application/pdf' THEN 'pdf'::"DocumentKind" ELSE 'image'::"DocumentKind" END,
  "title" = "originalName";
ALTER TABLE "Document" ALTER COLUMN "kind" SET NOT NULL,
ALTER COLUMN "title" SET NOT NULL;

-- CreateTable
CREATE TABLE "TripInvitation" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "invitedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "TripInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stay" (
    "tripId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "documentId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stay_pkey" PRIMARY KEY ("tripId","dayIndex")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "documentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transport" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "mode" "TransportMode" NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportDoc" (
    "id" UUID NOT NULL,
    "transportId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "documentId" UUID,

    CONSTRAINT "TransportDoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insurance" (
    "tripId" UUID NOT NULL,
    "company" TEXT NOT NULL,
    "policy" TEXT NOT NULL,
    "coverage" TEXT NOT NULL DEFAULT '',
    "emergencyPhone" TEXT NOT NULL DEFAULT '',
    "documentId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insurance_pkey" PRIMARY KEY ("tripId")
);

-- CreateTable
CREATE TABLE "Customs" (
    "tripId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "documentId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customs_pkey" PRIMARY KEY ("tripId")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "actionLabel" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" UUID NOT NULL,
    "tripId" UUID NOT NULL,
    "authorId" UUID NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "kind" "MemoryKind" NOT NULL,
    "visibility" "MemoryVisibility" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "storagePath" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "caption" TEXT,
    "blurhash" TEXT,
    "aspectRatio" DOUBLE PRECISION,
    "durationSeconds" INTEGER,
    "text" TEXT,
    "mood" "NoteMood",

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryReaction" (
    "memoryId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reaction" "Reaction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryReaction_pkey" PRIMARY KEY ("memoryId","userId")
);

-- CreateIndex
CREATE INDEX "TripInvitation_tripId_idx" ON "TripInvitation"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Stay_documentId_key" ON "Stay"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_documentId_key" ON "Activity"("documentId");

-- CreateIndex
CREATE INDEX "Activity_tripId_dayIndex_idx" ON "Activity"("tripId", "dayIndex");

-- CreateIndex
CREATE INDEX "Transport_tripId_idx" ON "Transport"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "TransportDoc_documentId_key" ON "TransportDoc"("documentId");

-- CreateIndex
CREATE INDEX "TransportDoc_transportId_idx" ON "TransportDoc"("transportId");

-- CreateIndex
CREATE UNIQUE INDEX "Insurance_documentId_key" ON "Insurance"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Customs_documentId_key" ON "Customs"("documentId");

-- CreateIndex
CREATE INDEX "EmergencyContact_tripId_idx" ON "EmergencyContact"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Memory_storagePath_key" ON "Memory"("storagePath");

-- CreateIndex
CREATE INDEX "Memory_tripId_createdAt_idx" ON "Memory"("tripId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Trip_inviteCode_key" ON "Trip"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "TripInvitation" ADD CONSTRAINT "TripInvitation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripInvitation" ADD CONSTRAINT "TripInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transport" ADD CONSTRAINT "Transport_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDoc" ADD CONSTRAINT "TransportDoc_transportId_fkey" FOREIGN KEY ("transportId") REFERENCES "Transport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransportDoc" ADD CONSTRAINT "TransportDoc_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insurance" ADD CONSTRAINT "Insurance_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insurance" ADD CONSTRAINT "Insurance_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customs" ADD CONSTRAINT "Customs_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customs" ADD CONSTRAINT "Customs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryReaction" ADD CONSTRAINT "MemoryReaction_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryReaction" ADD CONSTRAINT "MemoryReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

