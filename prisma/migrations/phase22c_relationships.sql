-- Phase 22 final (relationship semantics), part 2 of 2. Safe to run
-- twice. Requires phase22c_relationship_enums.sql to have run first.
--
-- Additive: new columns with defaults, new constraints and indexes, a
-- hierarchy trigger. No business, booking, customer, subscription or
-- payment row is touched. The only data changes are on organization
-- association rows:
--   * legacy relationship labels become their meaning
--     (TENANT, PARTNER → HOSTED; FRANCHISE → MANAGED);
--   * if a business were somehow owned by two organizations at once,
--     every OWNED row but the oldest is marked REMOVED (kept, not
--     deleted) so that the one-owner rule can be enforced.
-- RUN BEFORE DEPLOYING the code that uses it.

-- 1. Delegation on associations and invitations.
ALTER TABLE "OrganizationBusiness"
  ADD COLUMN IF NOT EXISTS "requestedScopes" "DelegationScope"[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "scopes"          "DelegationScope"[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "expiresAt"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedAt"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "suspendedById"   TEXT;
ALTER TABLE "OrganizationInvite"
  ADD COLUMN IF NOT EXISTS "requestedScopes" "DelegationScope"[] NOT NULL DEFAULT '{}';
ALTER TABLE "OrganizationBusiness" ALTER COLUMN "relation" SET DEFAULT 'HOSTED';

-- 2. Legacy labels become relationship types.
UPDATE "OrganizationBusiness" SET "relation" = 'HOSTED'  WHERE "relation"::text IN ('TENANT', 'PARTNER');
UPDATE "OrganizationBusiness" SET "relation" = 'MANAGED' WHERE "relation"::text = 'FRANCHISE';
UPDATE "OrganizationInvite"   SET "relation" = 'HOSTED'  WHERE "relation"::text IN ('TENANT', 'PARTNER');
UPDATE "OrganizationInvite"   SET "relation" = 'MANAGED' WHERE "relation"::text = 'FRANCHISE';

-- 3. What a relationship may carry, enforced by the database.
--    A hosting mall never operates its tenants.
DO $$ BEGIN
  ALTER TABLE "OrganizationBusiness" ADD CONSTRAINT "OrganizationBusiness_hosted_no_scopes_chk"
    CHECK ("relation"::text <> 'HOSTED' OR (cardinality("scopes") = 0 AND cardinality("requestedScopes") = 0));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--    Financial information only to an owner.
DO $$ BEGIN
  ALTER TABLE "OrganizationBusiness" ADD CONSTRAINT "OrganizationBusiness_finance_owned_chk"
    CHECK ("relation"::text = 'OWNED' OR NOT ('FINANCE'::"DelegationScope" = ANY ("scopes")));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--    A delegation limited to one branch can only run that branch's
--    reservations: customers, services, staff, hours, profile and
--    reports are business-wide and would leak the other branches.
DO $$ BEGIN
  ALTER TABLE "OrganizationBusiness" ADD CONSTRAINT "OrganizationBusiness_branch_scopes_chk"
    CHECK ("branchId" IS NULL OR "scopes" <@ ARRAY['RESERVATIONS']::"DelegationScope"[]);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. One live row per organization, business, branch AND relationship:
--    the same mall may host a tenant and also manage its bookings.
--    SUSPENDED is live (it holds the place until resumed or removed).
--    Index predicates compare the enum itself (part 1 committed these
--    values); an enum-to-text cast is not immutable and is refused here.
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationBusiness_live_rel_key"
  ON "OrganizationBusiness" ("organizationId", "businessId", (COALESCE("branchId", '')), "relation")
  WHERE "status" IN ('INVITED', 'REQUESTED', 'APPROVED', 'SUSPENDED');
DROP INDEX IF EXISTS "OrganizationBusiness_live_key";

-- 5. A business has at most one owning organization.
UPDATE "OrganizationBusiness" a SET "status" = 'REMOVED', "updatedAt" = now()
  FROM "OrganizationBusiness" b
  WHERE a."relation"::text = 'OWNED' AND b."relation"::text = 'OWNED'
    AND a."businessId" = b."businessId" AND a.id <> b.id
    AND a."status"::text IN ('INVITED', 'REQUESTED', 'APPROVED', 'SUSPENDED')
    AND b."status"::text IN ('INVITED', 'REQUESTED', 'APPROVED', 'SUSPENDED')
    AND (a."createdAt", a.id) > (b."createdAt", b.id);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationBusiness_one_owner_key"
  ON "OrganizationBusiness" ("businessId")
  WHERE "relation" = 'OWNED' AND "status" IN ('INVITED', 'REQUESTED', 'APPROVED', 'SUSPENDED');

-- 6. The platform's written reason for a rejection or suspension, kept on
--    the organization (it used to be read back from the audit log, which
--    is written best-effort and could lose it).
ALTER TABLE "VenueOrganization" ADD COLUMN IF NOT EXISTS "statusReason" TEXT;

-- 7. Organization hierarchy: a parent, never a cycle, at most three levels.
ALTER TABLE "VenueOrganization" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
DO $$ BEGIN ALTER TABLE "VenueOrganization" ADD CONSTRAINT "VenueOrganization_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "VenueOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "VenueOrganization" ADD CONSTRAINT "VenueOrganization_not_own_parent_chk" CHECK ("parentId" IS NULL OR "parentId" <> "id"); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "VenueOrganization_parentId_idx" ON "VenueOrganization" ("parentId");

CREATE OR REPLACE FUNCTION "organization_parent_guard"() RETURNS trigger AS $$
DECLARE
  cur   TEXT;
  above INT := 0;
  below INT;
BEGIN
  IF NEW."parentId" IS NULL THEN RETURN NEW; END IF;
  -- Hierarchy changes take turns, so two links made at the same moment
  -- (A under B, B under A) cannot each miss the other.
  PERFORM pg_advisory_xact_lock(hashtext('maw3ed-organization-hierarchy'));
  cur := NEW."parentId";
  WHILE cur IS NOT NULL LOOP
    above := above + 1;
    IF cur = NEW.id THEN
      RAISE EXCEPTION 'organization hierarchy cycle' USING ERRCODE = '23514';
    END IF;
    IF above > 10 THEN
      RAISE EXCEPTION 'organization hierarchy too deep' USING ERRCODE = '23514';
    END IF;
    SELECT "parentId" INTO cur FROM "VenueOrganization" WHERE id = cur;
  END LOOP;
  WITH RECURSIVE d(id, lvl) AS (
    SELECT id, 1 FROM "VenueOrganization" WHERE "parentId" = NEW.id
    UNION ALL
    SELECT o.id, d.lvl + 1 FROM "VenueOrganization" o JOIN d ON o."parentId" = d.id WHERE d.lvl < 10
  ) SELECT COALESCE(MAX(lvl), 0) INTO below FROM d;
  IF above + 1 + below > 3 THEN
    RAISE EXCEPTION 'organization hierarchy too deep' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "VenueOrganization_parent_guard" ON "VenueOrganization";
CREATE TRIGGER "VenueOrganization_parent_guard"
  BEFORE INSERT OR UPDATE OF "parentId" ON "VenueOrganization"
  FOR EACH ROW EXECUTE FUNCTION "organization_parent_guard"();
