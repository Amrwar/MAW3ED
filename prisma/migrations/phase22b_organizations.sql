-- Phase 22b: generic parent organizations. Safe to run twice. Additive:
-- the operator table (VenueOrganization) becomes the full Organization
-- profile; existing rows keep working and are marked APPROVED once (they
-- were created by platform administrators). No business, booking or
-- customer row is touched, and no ownership moves.
--
-- Run as a script (psql -f / prisma db execute), not inside
-- BEGIN/COMMIT: ALTER TYPE ... ADD VALUE commits on its own.
-- RUN BEFORE DEPLOYING the Phase 22b code.

-- 1. Enums.
DO $$ BEGIN CREATE TYPE "OrganizationKind" AS ENUM ('MALL', 'COMPOUND', 'BUSINESS_GROUP', 'FRANCHISE', 'COMMERCIAL_BUILDING', 'OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OrganizationBusinessRelation" AS ENUM ('OWNED', 'FRANCHISE', 'TENANT', 'PARTNER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "OrganizationBusinessStatus" AS ENUM ('INVITED', 'REQUESTED', 'APPROVED', 'DECLINED', 'REJECTED', 'REMOVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TYPE "VenueRoleKind" ADD VALUE IF NOT EXISTS 'ORGANIZATION_OWNER';

-- 2. The organization profile (same table the operators already use).
ALTER TABLE "VenueOrganization"
  ADD COLUMN IF NOT EXISTS "kind"          "OrganizationKind" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN IF NOT EXISTS "status"        "BusinessStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "isPublished"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "descriptionAr" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT,
  ADD COLUMN IF NOT EXISTS "logoImage"     TEXT,
  ADD COLUMN IF NOT EXISTS "coverImage"    TEXT,
  ADD COLUMN IF NOT EXISTS "phone"         TEXT,
  ADD COLUMN IF NOT EXISTS "email"         TEXT,
  ADD COLUMN IF NOT EXISTS "instagram"     TEXT,
  ADD COLUMN IF NOT EXISTS "facebook"      TEXT,
  ADD COLUMN IF NOT EXISTS "address"       TEXT,
  ADD COLUMN IF NOT EXISTS "cityId"        TEXT,
  ADD COLUMN IF NOT EXISTS "createdById"   TEXT;
DO $$ BEGIN ALTER TABLE "VenueOrganization" ADD CONSTRAINT "VenueOrganization_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "VenueOrganization_status_isPublished_idx" ON "VenueOrganization" ("status", "isPublished");

-- One-time: operators that exist at migration time were created by
-- platform administrators and stay usable. Marked done on the column so
-- a re-run never approves organizations that registered later.
DO $$
BEGIN
  IF coalesce(col_description('"VenueOrganization"'::regclass,
       (SELECT attnum FROM pg_attribute WHERE attrelid = '"VenueOrganization"'::regclass AND attname = 'status')), '')
     <> 'phase22b backfill done' THEN
    UPDATE "VenueOrganization" SET "status" = 'APPROVED' WHERE "status" = 'PENDING';
    COMMENT ON COLUMN "VenueOrganization"."status" IS 'phase22b backfill done';
  END IF;
END $$;

-- 3. The role scope rule admits the owner kind (and, forward-compatibly,
-- the Phase 23 security kind). Compared as text so this script never
-- uses an enum value inside the transaction that added it.
ALTER TABLE "VenueRole" DROP CONSTRAINT IF EXISTS "VenueRole_scope_chk";
ALTER TABLE "VenueRole" ADD CONSTRAINT "VenueRole_scope_chk" CHECK (
  ("kind"::text IN ('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN') AND "organizationId" IS NOT NULL AND "compoundId" IS NULL AND "venueId" IS NULL) OR
  ("kind"::text = 'COMPOUND_ADMIN' AND "compoundId" IS NOT NULL AND "organizationId" IS NULL AND "venueId" IS NULL) OR
  ("kind"::text IN ('VENUE_MANAGER', 'VENUE_SECURITY') AND "venueId" IS NOT NULL AND "organizationId" IS NULL AND "compoundId" IS NULL));

-- 4. Associations.
CREATE TABLE IF NOT EXISTS "OrganizationBusiness" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "businessId"     TEXT NOT NULL,
  "branchId"       TEXT,
  "relation"       "OrganizationBusinessRelation" NOT NULL DEFAULT 'TENANT',
  "status"         "OrganizationBusinessStatus" NOT NULL,
  "section"        TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "initiatedById"  TEXT NOT NULL,
  "decidedById"    TEXT,
  "decidedAt"      TIMESTAMP(3),
  "note"           TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationBusiness_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OrganizationBusiness_organizationId_status_idx" ON "OrganizationBusiness" ("organizationId", "status");
CREATE INDEX IF NOT EXISTS "OrganizationBusiness_businessId_status_idx" ON "OrganizationBusiness" ("businessId", "status");
-- One live row per organization, business and branch.
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationBusiness_live_key"
  ON "OrganizationBusiness" ("organizationId", "businessId", (COALESCE("branchId", '')))
  WHERE "status" IN ('INVITED', 'REQUESTED', 'APPROVED');
DO $$ BEGIN ALTER TABLE "OrganizationBusiness" ADD CONSTRAINT "OrganizationBusiness_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationBusiness" ADD CONSTRAINT "OrganizationBusiness_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "OrganizationBusiness" ADD CONSTRAINT "OrganizationBusiness_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Email invitations to create a new business under the organization.
CREATE TABLE IF NOT EXISTS "OrganizationInvite" (
  "id"                 TEXT NOT NULL,
  "organizationId"     TEXT NOT NULL,
  "email"              TEXT NOT NULL,
  "relation"           "OrganizationBusinessRelation" NOT NULL DEFAULT 'OWNED',
  "token"              TEXT NOT NULL,
  "invitedById"        TEXT NOT NULL,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "acceptedBusinessId" TEXT,
  "cancelledAt"        TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationInvite_token_key" ON "OrganizationInvite" ("token");
CREATE INDEX IF NOT EXISTS "OrganizationInvite_organizationId_idx" ON "OrganizationInvite" ("organizationId");
DO $$ BEGIN ALTER TABLE "OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Visits and booking attribution.
CREATE TABLE IF NOT EXISTS "OrganizationView" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "source"         "TrafficSource" NOT NULL,
  "day"            DATE NOT NULL,
  "count"          INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "OrganizationView_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationView_organizationId_source_day_key" ON "OrganizationView" ("organizationId", "source", "day");
DO $$ BEGIN ALTER TABLE "OrganizationView" ADD CONSTRAINT "OrganizationView_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "OrganizationBookingAttribution" (
  "id"             TEXT NOT NULL,
  "bookingId"      TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationBookingAttribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationBookingAttribution_bookingId_key" ON "OrganizationBookingAttribution" ("bookingId");
CREATE INDEX IF NOT EXISTS "OrganizationBookingAttribution_organizationId_createdAt_idx" ON "OrganizationBookingAttribution" ("organizationId", "createdAt");
DO $$ BEGIN ALTER TABLE "OrganizationBookingAttribution" ADD CONSTRAINT "OrganizationBookingAttribution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
