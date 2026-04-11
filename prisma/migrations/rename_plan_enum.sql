-- Migration: Rename Plan enum values FREE/GROWTH/PRO → FREE/PRO/PREMIUM
-- Also sets BerryGum (slug: amr-hefny) to PREMIUM plan.
--
-- Run this AFTER `prisma db push` has applied the new schema.
-- Execute via: psql $DATABASE_URL -f prisma/migrations/rename_plan_enum.sql

-- Step 1: Rename the existing enum type to a temporary name
ALTER TYPE "Plan" RENAME TO "Plan_old";

-- Step 2: Create the new enum with updated values
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- Step 3: Update the `plan` column on Business
ALTER TABLE "Business"
  ALTER COLUMN "plan" TYPE "Plan"
  USING (
    CASE "plan"::text
      WHEN 'FREE'   THEN 'FREE'::"Plan"
      WHEN 'GROWTH' THEN 'PRO'::"Plan"
      WHEN 'PRO'    THEN 'PREMIUM'::"Plan"
      ELSE 'FREE'::"Plan"
    END
  );

-- Step 4: Update the `pendingPlan` column on Business (nullable)
ALTER TABLE "Business"
  ALTER COLUMN "pendingPlan" TYPE "Plan"
  USING (
    CASE "pendingPlan"::text
      WHEN 'FREE'   THEN 'FREE'::"Plan"
      WHEN 'GROWTH' THEN 'PRO'::"Plan"
      WHEN 'PRO'    THEN 'PREMIUM'::"Plan"
      ELSE NULL
    END
  );

-- Step 5: Drop the old enum type
DROP TYPE "Plan_old";

-- Step 6: Set BerryGum to PREMIUM
UPDATE "Business"
SET "plan" = 'PREMIUM', "subscriptionStatus" = 'ACTIVE'
WHERE "slug" = 'amr-hefny';
