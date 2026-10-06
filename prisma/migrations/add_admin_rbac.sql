-- An administrative layer with roles, moderation states, and a record
-- of who did what.
--
-- Three things this adds, in order of how much they matter:
--
--   1. A role on the account. isAdmin was a single boolean, so the only
--      question it could answer was "everything or nothing". A person
--      who should only touch reported reviews had to be trusted with
--      payment data to do it.
--
--   2. A status on a business. isPublished said whether a page was
--      visible; it could not say whether a business was waiting to be
--      looked at, had been turned down, or had been suspended — three
--      different reasons for the same invisible page.
--
--   3. An audit log. Without one, "who suspended this business and
--      why" has no answer, which is exactly the question that gets
--      asked when somebody is upset.

DO $$ BEGIN
  CREATE TYPE "AdminRole" AS ENUM ('MODERATOR', 'ADMIN', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BusinessStatus" AS ENUM (
    'PENDING',    -- signed up, not yet looked at
    'APPROVED',   -- may be listed, subject to its own publish flag
    'REJECTED',   -- turned down; the owner is told why
    'SUSPENDED'   -- was approved, taken down since
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Who may administer what ──────────────────────────────────
-- Null means not an administrator, which is almost everybody.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "adminRole" "AdminRole";

-- Anyone already carrying the old boolean becomes a super admin: it
-- granted everything, so anything less would silently take away access
-- somebody already had.
UPDATE "User" SET "adminRole" = 'SUPER_ADMIN'
  WHERE "isAdmin" = true AND "adminRole" IS NULL;

CREATE INDEX IF NOT EXISTS "User_adminRole_idx" ON "User" ("adminRole");

-- ── Where a business stands ──────────────────────────────────
-- Existing businesses are APPROVED, not PENDING: they are already
-- listed and taking bookings, and moving them into a review queue
-- would take five live businesses off the site tonight.
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "status" "BusinessStatus" NOT NULL DEFAULT 'APPROVED',
  -- Shown to the owner when they are rejected or suspended. A decision
  -- with no reason attached is one nobody can act on.
  ADD COLUMN IF NOT EXISTS "statusNote" TEXT,
  ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "statusChangedById" TEXT,
  -- Editorially promoted. Separate from isVerified, which is earned by
  -- completing the profile and cannot be granted.
  ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "featuredAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Business_status_idx" ON "Business" ("status");
CREATE INDEX IF NOT EXISTS "Business_isFeatured_idx" ON "Business" ("isFeatured");

-- ── What happened ────────────────────────────────────────────
-- Append-only by convention: nothing in the application updates or
-- deletes a row here, and the admin screens offer no way to.
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"           TEXT NOT NULL,
  "at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- The account that acted. Kept as an id plus a copy of the name and
  -- role as they were at the time: a log that says "Admin" and then
  -- renders whoever holds that id today rewrites its own history when
  -- somebody is promoted or renamed.
  "actorId"      TEXT,
  "actorName"    TEXT,
  "actorRole"    TEXT,
  -- A machine-readable verb: "business.suspend", "review.hide".
  "action"       TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId"   TEXT,
  -- A sentence a person can read without decoding the metadata.
  "summary"      TEXT NOT NULL,
  -- Whatever the action needs to be understood later: the old and new
  -- values, the reason given, the amount. Never credentials, never a
  -- customer's contact details.
  "metadata"     JSONB,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_at_idx" ON "AuditLog" ("at" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_at_idx" ON "AuditLog" ("actorId", "at" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_resource_idx"
  ON "AuditLog" ("resourceType", "resourceId", "at" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog" ("action");
