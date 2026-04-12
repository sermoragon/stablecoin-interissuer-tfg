-- CreateEnum
CREATE TYPE "IdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" "IdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "responseStatusCode" INTEGER,
    "responseContentType" TEXT,
    "responseBody" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReplayNonce" (
    "id" TEXT NOT NULL,
    "issuer" "Issuer" NOT NULL,
    "nonce" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "signatureTimestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyRecord_status_createdAt_idx" ON "IdempotencyRecord"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_resourceType_resourceId_idx" ON "IdempotencyRecord"("resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_scope_idempotencyKey_key" ON "IdempotencyRecord"("scope", "idempotencyKey");

-- CreateIndex
CREATE INDEX "ReplayNonce_issuer_signatureTimestamp_idx" ON "ReplayNonce"("issuer", "signatureTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ReplayNonce_issuer_nonce_key" ON "ReplayNonce"("issuer", "nonce");
