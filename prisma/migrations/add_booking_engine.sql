-- CreateEnum
CREATE TYPE "TimeBlockKind" AS ENUM ('BREAK', 'HOLIDAY', 'VACATION', 'CLOSURE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'ARRIVED';
ALTER TYPE "BookingStatus" ADD VALUE 'IN_PROGRESS';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "endsAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "startsAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "minNoticeMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sameDayCutoff" TEXT;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "staffMemberId" TEXT,
    "branchId" TEXT,
    "kind" "TimeBlockKind" NOT NULL,
    "dayOfWeek" INTEGER,
    "startsOn" TIMESTAMP(3),
    "endsOn" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffHours" (
    "id" TEXT NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isOff" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StaffHours_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_businessId_isActive_sortOrder_idx" ON "Branch"("businessId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "TimeBlock_businessId_dayOfWeek_idx" ON "TimeBlock"("businessId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "TimeBlock_businessId_startsOn_endsOn_idx" ON "TimeBlock"("businessId", "startsOn", "endsOn");

-- CreateIndex
CREATE INDEX "TimeBlock_staffMemberId_idx" ON "TimeBlock"("staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffHours_staffMemberId_dayOfWeek_key" ON "StaffHours"("staffMemberId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_reference_key" ON "Booking"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Booking_businessId_startsAt_idx" ON "Booking"("businessId", "startsAt");

-- CreateIndex
CREATE INDEX "Booking_branchId_idx" ON "Booking"("branchId");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffHours" ADD CONSTRAINT "StaffHours_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

