-- Phase 22: destinations — organisations, compounds, venues, zones, gates,
-- hours, visitor policy, exceptions, tenancy (memberships) and venue roles.
-- Safe to run twice. Additive only: no existing table loses or changes a
-- column, and no business, branch, booking or customer row is touched.
-- Every existing business stays exactly where it is — outside any venue —
-- until its owner asks to join one and the venue approves.
--
-- RUN BEFORE DEPLOYING the Phase 22 code (the venue pages, dashboard and
-- admin read these tables; the rest of the site does not).

-- 1. Country at the top of the hierarchy. Every existing city is Egyptian.
ALTER TABLE "City" ADD COLUMN IF NOT EXISTS "countryCode" TEXT NOT NULL DEFAULT 'EG';

-- 2. Enums.
DO $$ BEGIN CREATE TYPE "VenueKind" AS ENUM ('MALL', 'OFFICE_COMPLEX', 'BUSINESS_PARK', 'MIXED_USE', 'COMMUNITY_CENTER', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VenueStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VenueZoneKind" AS ENUM ('FLOOR', 'ZONE', 'WING');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "GateKind" AS ENUM ('VEHICLE', 'PEDESTRIAN', 'MIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VisitorEligibility" AS ENUM ('OPEN', 'BOOKING_REQUIRED', 'OPERATOR_MANAGED', 'CLOSED_TO_VISITORS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VenueExceptionKind" AS ENUM ('CLOSED', 'ACCESS_SUSPENDED', 'SPECIAL_HOURS', 'BOOKINGS_PAUSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MembershipStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "VenueRoleKind" AS ENUM ('ORGANIZATION_ADMIN', 'COMPOUND_ADMIN', 'VENUE_MANAGER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tables.
CREATE TABLE IF NOT EXISTS "VenueOrganization" (
  "id"        TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "nameAr"    TEXT NOT NULL,
  "nameEn"    TEXT,
  "website"   TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VenueOrganization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VenueOrganization_slug_key" ON "VenueOrganization" ("slug");

CREATE TABLE IF NOT EXISTS "Compound" (
  "id"             TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "nameAr"         TEXT NOT NULL,
  "nameEn"         TEXT,
  "organizationId" TEXT,
  "cityId"         TEXT NOT NULL,
  "neighborhoodId" TEXT,
  "latitude"       DOUBLE PRECISION,
  "longitude"      DOUBLE PRECISION,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Compound_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Compound_slug_key" ON "Compound" ("slug");
CREATE INDEX IF NOT EXISTS "Compound_cityId_idx" ON "Compound" ("cityId");
CREATE INDEX IF NOT EXISTS "Compound_organizationId_idx" ON "Compound" ("organizationId");

CREATE TABLE IF NOT EXISTS "Venue" (
  "id"             TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "kind"           "VenueKind" NOT NULL DEFAULT 'MALL',
  "status"         "VenueStatus" NOT NULL DEFAULT 'DRAFT',
  "isPublished"    BOOLEAN NOT NULL DEFAULT false,
  "nameAr"         TEXT NOT NULL,
  "nameEn"         TEXT,
  "descriptionAr"  TEXT,
  "descriptionEn"  TEXT,
  "organizationId" TEXT,
  "compoundId"     TEXT,
  "cityId"         TEXT NOT NULL,
  "neighborhoodId" TEXT,
  "address"        TEXT,
  "latitude"       DOUBLE PRECISION,
  "longitude"      DOUBLE PRECISION,
  "phone"          TEXT,
  "website"        TEXT,
  "coverImage"     TEXT,
  "logoImage"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Venue_slug_key" ON "Venue" ("slug");
CREATE INDEX IF NOT EXISTS "Venue_isPublished_status_cityId_idx" ON "Venue" ("isPublished", "status", "cityId");
CREATE INDEX IF NOT EXISTS "Venue_compoundId_idx" ON "Venue" ("compoundId");
CREATE INDEX IF NOT EXISTS "Venue_organizationId_idx" ON "Venue" ("organizationId");

CREATE TABLE IF NOT EXISTS "VenueZone" (
  "id"        TEXT NOT NULL,
  "venueId"   TEXT NOT NULL,
  "kind"      "VenueZoneKind" NOT NULL DEFAULT 'FLOOR',
  "nameAr"    TEXT NOT NULL,
  "nameEn"    TEXT,
  "level"     INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueZone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VenueZone_venueId_sortOrder_idx" ON "VenueZone" ("venueId", "sortOrder");

CREATE TABLE IF NOT EXISTS "VenueGate" (
  "id"         TEXT NOT NULL,
  "venueId"    TEXT,
  "compoundId" TEXT,
  "nameAr"     TEXT NOT NULL,
  "nameEn"     TEXT,
  "kind"       "GateKind" NOT NULL DEFAULT 'MIXED',
  "code"       TEXT,
  "latitude"   DOUBLE PRECISION,
  "longitude"  DOUBLE PRECISION,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueGate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VenueGate_venueId_idx" ON "VenueGate" ("venueId");
CREATE INDEX IF NOT EXISTS "VenueGate_compoundId_idx" ON "VenueGate" ("compoundId");

CREATE TABLE IF NOT EXISTS "VenueHours" (
  "id"        TEXT NOT NULL,
  "venueId"   TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "openTime"  TEXT NOT NULL,
  "closeTime" TEXT NOT NULL,
  "isClosed"  BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "VenueHours_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VenueHours_venueId_dayOfWeek_key" ON "VenueHours" ("venueId", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "VenuePolicy" (
  "id"                   TEXT NOT NULL,
  "venueId"              TEXT NOT NULL,
  "visitorEligibility"   "VisitorEligibility" NOT NULL DEFAULT 'OPEN',
  "accessBeforeMinutes"  INTEGER NOT NULL DEFAULT 30,
  "accessAfterMinutes"   INTEGER NOT NULL DEFAULT 30,
  "maxGuestsPerBooking"  INTEGER NOT NULL DEFAULT 0,
  "reentryAllowed"       BOOLEAN NOT NULL DEFAULT false,
  "allowedGateIds"       TEXT[] DEFAULT ARRAY[]::TEXT[],
  "accessInstructionsAr" TEXT,
  "accessInstructionsEn" TEXT,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  "updatedById"          TEXT,
  CONSTRAINT "VenuePolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "VenuePolicy_venueId_key" ON "VenuePolicy" ("venueId");

CREATE TABLE IF NOT EXISTS "VenueException" (
  "id"          TEXT NOT NULL,
  "venueId"     TEXT NOT NULL,
  "kind"        "VenueExceptionKind" NOT NULL,
  "startsOn"    DATE NOT NULL,
  "endsOn"      DATE NOT NULL,
  "openTime"    TEXT,
  "closeTime"   TEXT,
  "noteAr"      TEXT,
  "noteEn"      TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueException_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VenueException_venueId_startsOn_idx" ON "VenueException" ("venueId", "startsOn");

CREATE TABLE IF NOT EXISTS "VenueMembership" (
  "id"            TEXT NOT NULL,
  "venueId"       TEXT NOT NULL,
  "businessId"    TEXT NOT NULL,
  "branchId"      TEXT,
  "zoneId"        TEXT,
  "unit"          TEXT,
  "status"        "MembershipStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedById" TEXT NOT NULL,
  "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById"   TEXT,
  "decidedAt"     TIMESTAMP(3),
  "decisionNote"  TEXT,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VenueMembership_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VenueMembership_venueId_status_idx" ON "VenueMembership" ("venueId", "status");
CREATE INDEX IF NOT EXISTS "VenueMembership_businessId_status_idx" ON "VenueMembership" ("businessId", "status");
-- One live (requested or approved) membership per venue, business and
-- branch; a rejected or removed one may be asked for again.
CREATE UNIQUE INDEX IF NOT EXISTS "VenueMembership_live_key"
  ON "VenueMembership" ("venueId", "businessId", (COALESCE("branchId", '')))
  WHERE "status" IN ('REQUESTED', 'APPROVED');

CREATE TABLE IF NOT EXISTS "VenueRole" (
  "id"             TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "kind"           "VenueRoleKind" NOT NULL,
  "organizationId" TEXT,
  "compoundId"     TEXT,
  "venueId"        TEXT,
  "grantedById"    TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VenueRole_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "VenueRole_userId_idx" ON "VenueRole" ("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "VenueRole_scope_key"
  ON "VenueRole" ("userId", "kind", (COALESCE("organizationId", '')), (COALESCE("compoundId", '')), (COALESCE("venueId", '')));

-- 4. Rules the schema language cannot say.
DO $$ BEGIN
  ALTER TABLE "VenueRole" ADD CONSTRAINT "VenueRole_scope_chk" CHECK (
    ("kind" = 'ORGANIZATION_ADMIN' AND "organizationId" IS NOT NULL AND "compoundId" IS NULL AND "venueId" IS NULL) OR
    ("kind" = 'COMPOUND_ADMIN'     AND "compoundId"     IS NOT NULL AND "organizationId" IS NULL AND "venueId" IS NULL) OR
    ("kind" = 'VENUE_MANAGER'      AND "venueId"        IS NOT NULL AND "organizationId" IS NULL AND "compoundId" IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "VenueGate" ADD CONSTRAINT "VenueGate_owner_chk" CHECK (("venueId" IS NULL) <> ("compoundId" IS NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "VenueHours" ADD CONSTRAINT "VenueHours_day_chk" CHECK ("dayOfWeek" BETWEEN 0 AND 6);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "VenueException" ADD CONSTRAINT "VenueException_range_chk" CHECK ("endsOn" >= "startsOn");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "VenuePolicy" ADD CONSTRAINT "VenuePolicy_ranges_chk" CHECK (
    "accessBeforeMinutes" BETWEEN 0 AND 720 AND "accessAfterMinutes" BETWEEN 0 AND 720 AND "maxGuestsPerBooking" BETWEEN 0 AND 50);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Foreign keys.
DO $$ BEGIN ALTER TABLE "Compound" ADD CONSTRAINT "Compound_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "VenueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Compound" ADD CONSTRAINT "Compound_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Compound" ADD CONSTRAINT "Compound_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Venue" ADD CONSTRAINT "Venue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "VenueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Venue" ADD CONSTRAINT "Venue_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Venue" ADD CONSTRAINT "Venue_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Venue" ADD CONSTRAINT "Venue_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueZone" ADD CONSTRAINT "VenueZone_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueGate" ADD CONSTRAINT "VenueGate_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueGate" ADD CONSTRAINT "VenueGate_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueHours" ADD CONSTRAINT "VenueHours_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenuePolicy" ADD CONSTRAINT "VenuePolicy_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueException" ADD CONSTRAINT "VenueException_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueMembership" ADD CONSTRAINT "VenueMembership_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueMembership" ADD CONSTRAINT "VenueMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueMembership" ADD CONSTRAINT "VenueMembership_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueMembership" ADD CONSTRAINT "VenueMembership_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "VenueZone"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueRole" ADD CONSTRAINT "VenueRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueRole" ADD CONSTRAINT "VenueRole_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueRole" ADD CONSTRAINT "VenueRole_compoundId_fkey" FOREIGN KEY ("compoundId") REFERENCES "Compound"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueRole" ADD CONSTRAINT "VenueRole_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
