-- A centre for notifications: one ledger, one set of preferences.
--
-- Nothing here replaces the WhatsApp and email senders that already
-- work. It gives them a single place to be called from, a record of
-- what was sent so nothing is sent twice, and preferences that are
-- actually read — the customer toggles in /account/settings were being
-- written and then ignored by every sender.

-- ── The events worth telling somebody about ──────────────────
-- Postgres will not let a new enum value be used in the same
-- transaction that adds it, so these go in on their own.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'BOOKING_CREATED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'BOOKING_REJECTED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'BOOKING_STARTING_SOON';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PAYMENT_RECEIVED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'PAYMENT_FAILED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWAL_DUE';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_EXPIRED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RENEWED';
