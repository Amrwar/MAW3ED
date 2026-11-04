-- Rolls back phase26_search_funnel.sql. Run only AFTER the Phase 26 code
-- has been reverted: that code reads "searchKey" and writes the funnel
-- tables. The funnel counts are lost; nothing else is.
DROP TABLE IF EXISTS "FunnelSeen";
DROP TABLE IF EXISTS "FunnelCount";
DROP TYPE IF EXISTS "FunnelStep";
DROP INDEX IF EXISTS "Business_searchKey_trgm";
DROP INDEX IF EXISTS "Service_searchKey_trgm";
ALTER TABLE "Business" DROP COLUMN IF EXISTS "searchKey";
ALTER TABLE "Service" DROP COLUMN IF EXISTS "searchKey";
ALTER TABLE "StaffMember" DROP COLUMN IF EXISTS "searchKey";
ALTER TABLE "Category" DROP COLUMN IF EXISTS "searchKey";
ALTER TABLE "City" DROP COLUMN IF EXISTS "searchKey";
ALTER TABLE "Neighborhood" DROP COLUMN IF EXISTS "searchKey";
ALTER TABLE "VenueOrganization" DROP COLUMN IF EXISTS "searchKey";
ALTER TABLE "Venue" DROP COLUMN IF EXISTS "searchKey";
DROP FUNCTION IF EXISTS maw3ed_search_norm(text);
-- pg_trgm is left installed: harmless, and other objects may use it.
