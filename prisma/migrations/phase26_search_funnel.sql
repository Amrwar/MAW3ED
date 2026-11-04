-- Phase 26: Arabic-aware search, and a booking funnel counted without
-- identifying anybody.
--
-- Additive and idempotent. Run BEFORE the Phase 26 code deploys: the new
-- code reads "searchKey" and writes the funnel tables.
--
-- 1. Search. maw3ed_search_norm() folds text the way the query is folded
--    in src/lib/discovery/normalize.ts (lower case; tashkeel, superscript
--    alef and tatweel removed; أ إ آ ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي;
--    Arabic-Indic and Persian digits → 0-9; whitespace collapsed). Each
--    searchable table gets a STORED generated "searchKey" the application
--    never writes. Adding a stored generated column rewrites the table once;
--    these tables are small.
-- 2. Funnel. "FunnelCount" is a counter like "ProfileView": one row per
--    day, step, channel, business and organization. "FunnelSeen" holds a
--    keyed hash of (random per-tab id, step, business, organization, day)
--    for two days, so the same tab reaching the same step twice counts
--    once. Neither table holds an address, a cookie, an account or a
--    device id.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION maw3ed_search_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
RETURN btrim(regexp_replace(
  translate(
    regexp_replace(lower(coalesce(t, '')), '[ً-ٰٟـ]', '', 'g'),
    'أإآٱةىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
    'ااااهيوي01234567890123456789'
  ),
  '\s+', ' ', 'g'));

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "searchKey" TEXT
  GENERATED ALWAYS AS (maw3ed_search_norm(
    coalesce("nameAr", '') || ' ' || coalesce("nameEn", '') || ' ' || coalesce("taglineAr", ''))) STORED;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "searchKey" TEXT
  GENERATED ALWAYS AS (maw3ed_search_norm(coalesce("nameAr", '') || ' ' || coalesce("nameEn", ''))) STORED;
ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "searchKey" TEXT
  GENERATED ALWAYS AS (maw3ed_search_norm(coalesce("nameAr", '') || ' ' || coalesce("nameEn", ''))) STORED;
ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "searchKey" TEXT
  GENERATED ALWAYS AS (maw3ed_search_norm(coalesce("nameAr", '') || ' ' || coalesce("nameEn", ''))) STORED;
ALTER TABLE "City" ADD COLUMN IF NOT EXISTS "searchKey" TEXT
  GENERATED ALWAYS AS (maw3ed_search_norm(coalesce("nameAr", '') || ' ' || coalesce("nameEn", ''))) STORED;
ALTER TABLE "Neighborhood" ADD COLUMN IF NOT EXISTS "searchKey" TEXT
  GENERATED ALWAYS AS (maw3ed_search_norm(coalesce("nameAr", '') || ' ' || coalesce("nameEn", ''))) STORED;
ALTER TABLE "VenueOrganization" ADD COLUMN IF NOT EXISTS "searchKey" TEXT
  GENERATED ALWAYS AS (maw3ed_search_norm(coalesce("nameAr", '') || ' ' || coalesce("nameEn", ''))) STORED;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "searchKey" TEXT
  GENERATED ALWAYS AS (maw3ed_search_norm(coalesce("nameAr", '') || ' ' || coalesce("nameEn", ''))) STORED;

-- Trigram indexes serve ILIKE '%term%' on the two tables that grow.
CREATE INDEX IF NOT EXISTS "Business_searchKey_trgm" ON "Business" USING gin ("searchKey" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Service_searchKey_trgm" ON "Service" USING gin ("searchKey" gin_trgm_ops);

DO $$ BEGIN
  CREATE TYPE "FunnelStep" AS ENUM (
    'MARKETPLACE_VIEW', 'SEARCH', 'ORGANIZATION_VIEW', 'BUSINESS_VIEW',
    'SERVICE_SELECTED', 'BOOKING_STARTED', 'TIME_SELECTED',
    'FOR_BUSINESS_VIEW', 'PRICING_VIEW', 'DEMO_VIEW', 'SIGNUP_VIEW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "FunnelCount" (
  "id"             TEXT PRIMARY KEY,
  "day"            DATE NOT NULL,
  "step"           "FunnelStep" NOT NULL,
  "source"         "TrafficSource" NOT NULL,
  "businessId"     TEXT NOT NULL DEFAULT '',
  "organizationId" TEXT NOT NULL DEFAULT '',
  "count"          INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS "FunnelCount_day_step_source_businessId_organizationId_key"
  ON "FunnelCount" ("day", "step", "source", "businessId", "organizationId");
CREATE INDEX IF NOT EXISTS "FunnelCount_businessId_day_idx" ON "FunnelCount" ("businessId", "day");
CREATE INDEX IF NOT EXISTS "FunnelCount_organizationId_day_idx" ON "FunnelCount" ("organizationId", "day");

CREATE TABLE IF NOT EXISTS "FunnelSeen" (
  "key" TEXT PRIMARY KEY,
  "day" DATE NOT NULL
);
CREATE INDEX IF NOT EXISTS "FunnelSeen_day_idx" ON "FunnelSeen" ("day");
