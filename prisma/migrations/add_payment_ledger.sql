-- A ledger for money.
--
-- Payment state lived in four nullable string columns: paymobOrderId
-- and paymobTransactionId on Booking, subscriptionPaymobOrderId and
-- pendingPlan on Business. That is enough to confirm one booking once.
-- It cannot hold a second payment against the same booking, a refund, a
-- receipt, a failed attempt, or an answer to "what has this business
-- actually paid us". The admin payments page inferred its totals from
-- Booking rows because there was nothing else to read.
--
-- Three tables:
--
--   Payment       one attempt to move money, written BEFORE the
--                 customer is sent to the provider so an abandoned
--                 payment leaves a trace rather than nothing.
--
--   Refund        money sent back, with who issued it and why.
--
--   WebhookEvent  every callback the provider has sent, keyed by its
--                 own transaction id. This is the idempotency record:
--                 Paymob retries anything it did not hear a clean 200
--                 for, and two retries can arrive at once. The unique
--                 key means the second insert loses and that delivery
--                 does nothing.
--
-- The old columns are left in place and still written. They are how
-- payments made before this migration are found, and dropping them
-- would strand four live bookings.

-- ─── Types ───────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "PaymentKind" AS ENUM (
    'BOOKING_DEPOSIT',  -- part of the price, up front, to hold the slot
    'BOOKING_BALANCE',  -- the rest of it, after a deposit
    'BOOKING_FULL',     -- the whole price in one go
    'SUBSCRIPTION'      -- a business buying a plan
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentProvider" AS ENUM ('PAYMOB', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'WALLET', 'CASH', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM (
    'PENDING',
    'SUCCEEDED',
    'FAILED',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'ABANDONED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Payment ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Payment" (
  "id"                    TEXT PRIMARY KEY,
  "kind"                  "PaymentKind"     NOT NULL,
  "status"                "PaymentStatus"   NOT NULL DEFAULT 'PENDING',
  "provider"              "PaymentProvider" NOT NULL DEFAULT 'PAYMOB',
  "method"                "PaymentMethod",

  -- Piastres, never pounds. Paymob charges in the minor unit and
  -- rounding between the two is how money goes missing.
  "amountCents"           INTEGER NOT NULL,
  "currency"              TEXT    NOT NULL DEFAULT 'EGP',
  "refundedCents"         INTEGER NOT NULL DEFAULT 0,

  "providerOrderId"       TEXT,
  "providerTransactionId" TEXT,

  "bookingId"             TEXT,
  "businessId"            TEXT NOT NULL,
  "plan"                  "Plan",

  "receiptNumber"         TEXT,
  "paidAt"                TIMESTAMP(3),
  "failureReason"         TEXT,
  "recordedById"          TEXT,

  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Payment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL,
  CONSTRAINT "Payment_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,
  CONSTRAINT "Payment_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL,

  -- A payment is always either against a booking or for a plan, and
  -- never both. Enforced here rather than in the application, because
  -- the application is not the only thing that will ever write a row.
  CONSTRAINT "Payment_target_chk" CHECK (
    ("kind" = 'SUBSCRIPTION' AND "plan" IS NOT NULL  AND "bookingId" IS NULL)
    OR
    ("kind" <> 'SUBSCRIPTION' AND "bookingId" IS NOT NULL)
  ),

  CONSTRAINT "Payment_amount_chk"   CHECK ("amountCents" > 0),
  -- Cannot refund more than was taken.
  CONSTRAINT "Payment_refunded_chk" CHECK ("refundedCents" >= 0 AND "refundedCents" <= "amountCents")
);

-- These two are what make a replayed webhook a no-op rather than a
-- second confirmation.
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerOrderId_key"       ON "Payment"("providerOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_providerTransactionId_key" ON "Payment"("providerTransactionId");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_receiptNumber_key"         ON "Payment"("receiptNumber");

CREATE INDEX IF NOT EXISTS "Payment_businessId_createdAt_idx" ON "Payment"("businessId", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_bookingId_idx"            ON "Payment"("bookingId");
CREATE INDEX IF NOT EXISTS "Payment_status_createdAt_idx"     ON "Payment"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Payment_kind_createdAt_idx"       ON "Payment"("kind", "createdAt");

-- ─── Refund ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Refund" (
  "id"               TEXT PRIMARY KEY,
  "paymentId"        TEXT NOT NULL,
  "amountCents"      INTEGER NOT NULL,
  "status"           "RefundStatus" NOT NULL DEFAULT 'PENDING',

  "providerRefundId" TEXT,
  "reason"           TEXT NOT NULL,
  "failureReason"    TEXT,

  -- Copied, not joined: the record should still read correctly if the
  -- account is later removed.
  "actorId"          TEXT,
  "actorName"        TEXT NOT NULL,

  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Refund_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE,
  CONSTRAINT "Refund_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL,

  CONSTRAINT "Refund_amount_chk" CHECK ("amountCents" > 0)
);

CREATE INDEX IF NOT EXISTS "Refund_paymentId_idx"        ON "Refund"("paymentId");
CREATE INDEX IF NOT EXISTS "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

-- ─── WebhookEvent ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "WebhookEvent" (
  "id"          TEXT PRIMARY KEY,
  "provider"    "PaymentProvider" NOT NULL,
  "eventId"     TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "outcome"     TEXT
);

-- The idempotency key itself.
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_provider_eventId_key"
  ON "WebhookEvent"("provider", "eventId");
CREATE INDEX IF NOT EXISTS "WebhookEvent_receivedAt_idx" ON "WebhookEvent"("receivedAt");

-- ─── Receipt numbers ─────────────────────────────────────────────────
-- Sequential and human-quotable: a customer reads "MW-000042" down the
-- phone to support. A sequence rather than a count of rows, so two
-- payments settling at the same moment cannot be handed the same one.

CREATE SEQUENCE IF NOT EXISTS "payment_receipt_seq" START 1;
