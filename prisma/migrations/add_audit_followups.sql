-- Two additions from the Oct 27 audit follow-ups. Safe to run twice.
--
-- 1. Payment."periodMonths": how many months a SUBSCRIPTION payment
--    buys. 1 for a month, 12 for a year paid up front at ten months'
--    price. Every existing row was a month, which the default says.
--    The webhook extends the business's period by this much.
--
-- 2. "WaitlistRequest": "notify me when a dentist joins", left from a
--    search that found nothing, confirmed from an email link before it
--    counts. Read in /admin/waitlist.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "periodMonths" INTEGER NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE "Payment"
    ADD CONSTRAINT "Payment_periodMonths_check" CHECK ("periodMonths" IN (1, 12));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "WaitlistRequest" (
  "id"         TEXT PRIMARY KEY,
  "email"      TEXT NOT NULL,
  "query"      TEXT NOT NULL,
  "citySlug"   TEXT NOT NULL DEFAULT '',
  "lang"         TEXT NOT NULL DEFAULT 'ar',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmToken" TEXT,
  "confirmedAt"  TIMESTAMP(3),
  "notifiedAt"   TIMESTAMP(3)
);

ALTER TABLE "WaitlistRequest" ADD COLUMN IF NOT EXISTS "confirmToken" TEXT;
ALTER TABLE "WaitlistRequest" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistRequest_confirmToken_key"
  ON "WaitlistRequest" ("confirmToken");

CREATE UNIQUE INDEX IF NOT EXISTS "WaitlistRequest_email_query_citySlug_key"
  ON "WaitlistRequest" ("email", "query", "citySlug");
CREATE INDEX IF NOT EXISTS "WaitlistRequest_createdAt_idx"
  ON "WaitlistRequest" ("createdAt");
