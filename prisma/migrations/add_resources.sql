-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('TABLE', 'ROOM', 'CHAIR', 'EQUIPMENT', 'OTHER');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "resourceId" TEXT;

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "kind" "ResourceKind" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "area" TEXT,
    "notes" TEXT,
    "photo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Resource_businessId_isActive_sortOrder_idx" ON "Resource"("businessId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "Resource_branchId_idx" ON "Resource"("branchId");

-- CreateIndex
CREATE INDEX "Booking_resourceId_idx" ON "Booking"("resourceId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

