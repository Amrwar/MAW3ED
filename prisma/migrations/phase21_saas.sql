-- Phase 21: business onboarding and SaaS maturity. Safe to run twice.
-- RUN BEFORE DEPLOYING the Phase 21 code: onboarding, publishing, the
-- booking routes and the dashboard read the new columns and tables.
--
-- 1. Business setup state: publishRequestedAt (the owner pressed
--    Publish), policiesReviewedAt, cancellationCutoffHours (was a
--    constant 2 h), and identity verification by an administrator.
--
-- 2. The public "موثّق" badge (isVerified) was earned automatically
--    once the owner confirmed an email and a phone and filled in the
--    page. That is contact verification, and a customer reads the badge
--    as "this business is who it says it is". From now on the badge
--    means an administrator checked ownership: identityVerifiedAt is
--    taken from the last "business.verify" audit entry not undone by a
--    later "business.unverify", and isVerified follows it. Listings that
--    only had the automatic badge lose it; that is the correction, and
--    the dashboard shows owners what contact checks they have passed.
--
-- 3. Booking."isTest": bookings the owner makes on their own page
--    before publishing.
--
-- 4. OnboardingDraft, ImportBatch, LifecycleEvent (+ enums), with the
--    lifecycle backfilled from existing rows so the onboarding funnel
--    starts from what already happened.

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "publishRequestedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "policiesReviewedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationCutoffHours"  INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "identityVerifiedAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "identityVerifiedById"     TEXT,
  ADD COLUMN IF NOT EXISTS "identityVerificationNote" TEXT;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

-- Every business that exists already went through the old flow, where
-- creating it was asking to be published.
UPDATE "Business" SET "publishRequestedAt" = "createdAt" WHERE "publishRequestedAt" IS NULL;

-- Identity verification from the admin audit trail, once.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "Business" WHERE "identityVerifiedAt" IS NOT NULL) THEN
    UPDATE "Business" b
       SET "identityVerifiedAt" = v.at,
           "identityVerifiedById" = v."actorId",
           "identityVerificationNote" = 'carried over from an admin verification before Phase 21'
      FROM (
        SELECT DISTINCT ON ("resourceId") "resourceId", action, at, "actorId"
          FROM "AuditLog"
         WHERE action IN ('business.verify', 'business.unverify')
         ORDER BY "resourceId", at DESC
      ) v
     WHERE v."resourceId" = b.id AND v.action = 'business.verify';
    UPDATE "Business" SET "isVerified" = ("identityVerifiedAt" IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OnboardingDraft" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "step"      INTEGER NOT NULL DEFAULT 1,
  "data"      JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnboardingDraft_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingDraft_userId_key" ON "OnboardingDraft" ("userId");
DO $$ BEGIN
  ALTER TABLE "OnboardingDraft" ADD CONSTRAINT "OnboardingDraft_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ImportKind" AS ENUM ('CUSTOMERS', 'SERVICES');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ImportBatch" (
  "id"              TEXT NOT NULL,
  "businessId"      TEXT NOT NULL,
  "kind"            "ImportKind" NOT NULL,
  "createdById"     TEXT NOT NULL,
  "fileName"        TEXT,
  "rowCount"        INTEGER NOT NULL,
  "createdIds"      TEXT[],
  "skipped"         INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rolledBackAt"    TIMESTAMP(3),
  "rolledBackCount" INTEGER,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ImportBatch_businessId_createdAt_idx" ON "ImportBatch" ("businessId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "LifecycleEventKind" AS ENUM (
    'BUSINESS_REGISTERED', 'ONBOARDING_STARTED', 'PROFILE_COMPLETED', 'PUBLISHED',
    'FIRST_BOOKING', 'FIRST_COMPLETED_BOOKING', 'FIRST_PAID_SUBSCRIPTION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "LifecycleEvent" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "businessId" TEXT,
  "kind"       "LifecycleEventKind" NOT NULL,
  "at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LifecycleEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LifecycleEvent_userId_kind_key" ON "LifecycleEvent" ("userId", "kind");
CREATE INDEX IF NOT EXISTS "LifecycleEvent_kind_at_idx" ON "LifecycleEvent" ("kind", "at");

-- Backfill: what already happened, from the rows that prove it.
INSERT INTO "LifecycleEvent" ("id", "userId", "businessId", "kind", "at")
SELECT 'bf-reg-' || b.id, b."ownerId", b.id, 'BUSINESS_REGISTERED', b."createdAt" FROM "Business" b
ON CONFLICT ("userId", "kind") DO NOTHING;

INSERT INTO "LifecycleEvent" ("id", "userId", "businessId", "kind", "at")
SELECT 'bf-pub-' || b.id, b."ownerId", b.id, 'PUBLISHED', b."createdAt" FROM "Business" b WHERE b."isPublished"
ON CONFLICT ("userId", "kind") DO NOTHING;

INSERT INTO "LifecycleEvent" ("id", "userId", "businessId", "kind", "at")
SELECT 'bf-fb-' || b.id, b."ownerId", b.id, 'FIRST_BOOKING', min(bk."createdAt")
  FROM "Business" b JOIN "Booking" bk ON bk."businessId" = b.id AND NOT bk."isTest"
 GROUP BY b.id, b."ownerId"
ON CONFLICT ("userId", "kind") DO NOTHING;

INSERT INTO "LifecycleEvent" ("id", "userId", "businessId", "kind", "at")
SELECT 'bf-fc-' || b.id, b."ownerId", b.id, 'FIRST_COMPLETED_BOOKING', min(bk."updatedAt")
  FROM "Business" b JOIN "Booking" bk ON bk."businessId" = b.id AND bk.status = 'COMPLETED' AND NOT bk."isTest"
 GROUP BY b.id, b."ownerId"
ON CONFLICT ("userId", "kind") DO NOTHING;

INSERT INTO "LifecycleEvent" ("id", "userId", "businessId", "kind", "at")
SELECT 'bf-sub-' || b.id, b."ownerId", b.id, 'FIRST_PAID_SUBSCRIPTION', min(p."paidAt")
  FROM "Business" b JOIN "Payment" p ON p."businessId" = b.id AND p.kind = 'SUBSCRIPTION'
   AND p.status IN ('SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED') AND p."paidAt" IS NOT NULL
 GROUP BY b.id, b."ownerId"
ON CONFLICT ("userId", "kind") DO NOTHING;
