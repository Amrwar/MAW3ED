-- Part two: the ledger and the preferences.
-- Separate from part one because Postgres will not let the new enum
-- values be used in the transaction that added them.

-- ── Which way a notification went out ────────────────────────
DO $$ BEGIN
  CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'SKIPPED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── The ledger ───────────────────────────────────────────────
-- One row per (event, subject, recipient, channel). The unique index
-- on dedupeKey is the whole mechanism: a job claims the key before it
-- sends, so a cron that runs twice, a webhook Paymob retries, or a
-- double-tapped button cannot produce a second message.
CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
  "id"         TEXT NOT NULL,
  "dedupeKey"  TEXT NOT NULL,
  "kind"       "NotificationKind" NOT NULL,
  "channel"    "NotificationChannel" NOT NULL,
  "status"     "DeliveryStatus" NOT NULL,
  -- Who it went to, for support to answer "did they get it?". A phone
  -- or an email address; never the message body, which would put a
  -- customer's details in a second place for no reason.
  "recipient"  TEXT NOT NULL,
  "bookingId"  TEXT,
  "businessId" TEXT,
  "error"      TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NotificationDelivery_dedupeKey_key"
  ON "NotificationDelivery" ("dedupeKey");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_kind_createdAt_idx"
  ON "NotificationDelivery" ("kind", "createdAt");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_bookingId_idx"
  ON "NotificationDelivery" ("bookingId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_businessId_idx"
  ON "NotificationDelivery" ("businessId");

-- ── What a business wants to hear about ──────────────────────
-- Defaults match what businesses already receive today, so nobody's
-- notifications change until they choose to change them.
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "notifyByEmail"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyByWhatsApp"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyNewBooking"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyCancellation" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notifyPayment"     BOOLEAN NOT NULL DEFAULT true,
  -- Where alerts go. Null means the owner's email and the business's
  -- own WhatsApp number, which is what happens today.
  ADD COLUMN IF NOT EXISTS "notificationEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationPhone" TEXT;

-- ── Reminders, configurable ──────────────────────────────────
-- 24 hours is what the daily job sends today, so this changes nothing
-- until a business moves it.
ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "reminderEnabled"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "reminderLeadHours"    INTEGER NOT NULL DEFAULT 24,
  -- The second, shorter nudge. Off by default: it is an extra message
  -- to somebody who already had one, and that is the business's call.
  ADD COLUMN IF NOT EXISTS "startingSoonEnabled"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "startingSoonLeadMins" INTEGER NOT NULL DEFAULT 120,
  -- Asking for a review after the appointment is done.
  ADD COLUMN IF NOT EXISTS "reviewRequestEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Customers can already say how they want to be reached; the column
-- for the shorter nudge belongs with them too.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "notifyBySms" BOOLEAN NOT NULL DEFAULT false;
