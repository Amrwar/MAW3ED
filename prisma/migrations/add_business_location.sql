-- Business and branch locations, for the app's map and "near me".
--
-- Coordinates are whatever the owner pins in the dashboard. Nothing is
-- geocoded from an address or invented: a business without a pin keeps
-- working exactly as before, it just does not appear on the map or in
-- nearby results.
--
-- Both or neither, and in range, enforced here so no path into the
-- database can store half a location or an impossible one.
--
-- Safe to run twice.

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_location_valid') THEN
    ALTER TABLE "Business" ADD CONSTRAINT business_location_valid CHECK (
      ("latitude" IS NULL AND "longitude" IS NULL) OR
      ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'branch_location_valid') THEN
    ALTER TABLE "Branch" ADD CONSTRAINT branch_location_valid CHECK (
      ("latitude" IS NULL AND "longitude" IS NULL) OR
      ("latitude" BETWEEN -90 AND 90 AND "longitude" BETWEEN -180 AND 180)
    );
  END IF;
END $$;

-- The nearby query narrows by a bounding box on these before it computes
-- any distance.
CREATE INDEX IF NOT EXISTS "Business_latitude_longitude_idx" ON "Business" ("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "Branch_latitude_longitude_idx" ON "Branch" ("latitude", "longitude");
