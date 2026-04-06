-- CreateEnum
CREATE TYPE "Issuer" AS ENUM ('ISSUER_A', 'ISSUER_B');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'ISO_OUTBOUND_BUILT', 'ISO_SENT', 'ISO_INBOUND_RECEIVED', 'ISO_ACK_ACCEPTED', 'ISO_ACK_REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "IsoDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "correlationId" TEXT NOT NULL,
    "instructionId" TEXT NOT NULL,
    "endToEndId" TEXT NOT NULL,
    "senderIssuer" "Issuer" NOT NULL,
    "receiverIssuer" "Issuer" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IsoMessage" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "direction" "IsoDirection" NOT NULL,
    "messageType" TEXT NOT NULL,
    "businessMsgId" TEXT,
    "messageId" TEXT,
    "sender" TEXT NOT NULL,
    "receiver" TEXT NOT NULL,
    "rawXml" TEXT NOT NULL,
    "parsedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IsoMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_correlationId_key" ON "Payment"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_instructionId_key" ON "Payment"("instructionId");

-- AddForeignKey
ALTER TABLE "IsoMessage" ADD CONSTRAINT "IsoMessage_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentEvent" ADD CONSTRAINT "PaymentEvent_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
