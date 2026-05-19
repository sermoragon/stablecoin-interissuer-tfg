-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PaymentStatus" ADD VALUE 'XRPL_SETTLEMENT_REQUESTED';
ALTER TYPE "PaymentStatus" ADD VALUE 'XRPL_SETTLEMENT_CONFIRMED';
ALTER TYPE "PaymentStatus" ADD VALUE 'XRPL_SETTLEMENT_FAILED';
ALTER TYPE "PaymentStatus" ADD VALUE 'SETTLED';
