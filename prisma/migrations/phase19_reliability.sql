-- Phase 19: booking, payment and notification reliability.
-- Safe to run twice. RUN BEFORE DEPLOYING the Phase 19 code: the
-- notification dispatcher writes the new columns and enum values on
-- every send.
--
-- 1. The notification ledger becomes an outbox. A row used to be
--    inserted as SENT before the provider was asked, with nothing to
--    retry a failure or to notice a process that died mid-send
--    (docs/audits/CRITICAL_FINDINGS.md, P17-11). A row is now claimed
--    PENDING, moved to SENT/SKIPPED/FAILED when the provider answers,
--    retried with backoff while attempts remain, and marked DEAD when
--    they run out. `event` keeps what was being said, so a retry
--    rebuilds the message from the current booking.
--
--    ALTER TYPE ... ADD VALUE commits on its own and cannot be used in
--    the same transaction it was added in; run this file as a script
--    (psql -f), not inside BEGIN/COMMIT.

ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'PENDING' BEFORE 'SENT';
ALTER TYPE "DeliveryStatus" ADD VALUE IF NOT EXISTS 'DEAD';

ALTER TABLE "NotificationDelivery"
  ADD COLUMN IF NOT EXISTS "attempts"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "event"         JSONB;

CREATE INDEX IF NOT EXISTS "NotificationDelivery_status_nextAttemptAt_idx"
  ON "NotificationDelivery" ("status", "nextAttemptAt");

-- Rows written before this file: every one that was recorded SENT was
-- at least attempted once.
UPDATE "NotificationDelivery" SET "attempts" = 1 WHERE "attempts" = 0;
