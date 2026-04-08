/*
  Warnings:

  - You are about to drop the column `businessMsgId` on the `IsoMessage` table. All the data in the column will be lost.
  - You are about to alter the column `amount` on the `Payment` table. The data in that column could be lost. The data in that column will be cast from `Decimal(18,2)` to `Decimal(18,6)`.
  - Added the required column `creditorBic` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `creditorName` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `debtorBic` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `debtorName` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "IsoMessage" DROP COLUMN "businessMsgId",
ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "relatedMessageId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "creditorBic" TEXT NOT NULL,
ADD COLUMN     "creditorName" TEXT NOT NULL,
ADD COLUMN     "debtorBic" TEXT NOT NULL,
ADD COLUMN     "debtorName" TEXT NOT NULL,
ADD COLUMN     "remittanceInfo" TEXT,
ALTER COLUMN "amount" SET DATA TYPE DECIMAL(18,6);

-- CreateIndex
CREATE INDEX "IsoMessage_paymentId_createdAt_idx" ON "IsoMessage"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "IsoMessage_messageType_createdAt_idx" ON "IsoMessage"("messageType", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentEvent_paymentId_createdAt_idx" ON "PaymentEvent"("paymentId", "createdAt");
