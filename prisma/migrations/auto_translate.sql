-- Automatic English for text a business wrote only in Arabic
-- (lib/translate). Machine output lives in its own columns so the
-- owner's own English is never overwritten, and autoEnSource keeps a
-- fingerprint of the Arabic each translation came from.
--
-- Additive and idempotent. Run BEFORE the code that reads these
-- columns deploys.
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "nameEnAuto"    TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "taglineEnAuto" TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "aboutEnAuto"   TEXT;
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "autoEnSource"  JSONB;

ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "nameEnAuto"        TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "descriptionEnAuto" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "autoEnSource"      JSONB;
