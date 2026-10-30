-- ROLLBACK for phase22_venues.sql. Do NOT run as part of a normal deploy.
--
-- Removes everything Phase 22 added — and with it every venue,
-- compound, operator, floor, gate, policy, notice, tenancy and venue
-- role that was ever entered. No business, branch, booking, customer,
-- review or payment row is touched: none of them references a Phase 22
-- table, so nothing outside these tables is deleted.
--
-- Order matters only for readability; DROP TABLE ... CASCADE removes the
-- foreign keys between these tables. Safe to run twice.
--
-- Before running it on production:
--   1. Take a Neon snapshot (or note the time for point-in-time restore).
--   2. Deploy the code from before Phase 22 FIRST (it does not read these
--      tables). Running this under the Phase 22 code breaks /venues,
--      /venue-admin, /admin/venues and /dashboard/venue.
--   3. Run this file the same way as the migration.
--
-- Tested on the QA database on 2026-10-31: existing business, branch,
-- booking, customer and city counts identical before and after; the
-- migration re-applied cleanly afterwards.

DROP TABLE IF EXISTS "VenueRole" CASCADE;
DROP TABLE IF EXISTS "VenueMembership" CASCADE;
DROP TABLE IF EXISTS "VenueException" CASCADE;
DROP TABLE IF EXISTS "VenuePolicy" CASCADE;
DROP TABLE IF EXISTS "VenueHours" CASCADE;
DROP TABLE IF EXISTS "VenueGate" CASCADE;
DROP TABLE IF EXISTS "VenueZone" CASCADE;
DROP TABLE IF EXISTS "Venue" CASCADE;
DROP TABLE IF EXISTS "Compound" CASCADE;
DROP TABLE IF EXISTS "VenueOrganization" CASCADE;

DROP TYPE IF EXISTS "VenueRoleKind";
DROP TYPE IF EXISTS "MembershipStatus";
DROP TYPE IF EXISTS "VenueExceptionKind";
DROP TYPE IF EXISTS "VisitorEligibility";
DROP TYPE IF EXISTS "GateKind";
DROP TYPE IF EXISTS "VenueZoneKind";
DROP TYPE IF EXISTS "VenueStatus";
DROP TYPE IF EXISTS "VenueKind";

ALTER TABLE "City" DROP COLUMN IF EXISTS "countryCode";
