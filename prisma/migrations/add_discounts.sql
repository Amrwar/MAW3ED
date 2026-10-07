-- Coupons and promotions, as one thing.
--
-- A Discount with a code is a coupon: the customer types it. The same
-- record without a code is a promotion: it applies by itself to
-- anything matching its rules. Two tables would mean two code paths
-- that both reduce a price, and they would drift until a booking cost
-- one amount on the widget and another in the ledger.
--
-- Where the money goes, because this is the part that matters:
--
--   Booking.totalPrice   stored ALREADY reduced. It is what the
--                        customer owes, so every deposit, balance and
--                        payment calculation built in the payments
--                        phase keeps working without being taught that
--                        discounts exist.
--   Booking.discountCents  how much came off, for reporting. Never
--                        subtracted a second time.

DO $$ BEGIN
  CREATE TYPE "DiscountKind" AS ENUM ('PERCENT', 'FIXED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Discount" (
  "id"               TEXT PRIMARY KEY,
  "businessId"       TEXT NOT NULL,

  "code"             TEXT,
  "nameAr"           TEXT NOT NULL,
  "nameEn"           TEXT,

  "kind"             "DiscountKind" NOT NULL,
  "value"            INTEGER NOT NULL,

  "minSpendCents"    INTEGER,
  "maxDiscountCents" INTEGER,

  "maxRedemptions"   INTEGER,
  "perCustomerLimit" INTEGER,
  "redemptionCount"  INTEGER NOT NULL DEFAULT 0,

  "startsAt"         TIMESTAMP(3),
  "endsAt"           TIMESTAMP(3),
  "isActive"         BOOLEAN NOT NULL DEFAULT true,

  "serviceIds"       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Discount_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,

  -- A percentage above 100 would pay the customer to turn up. A fixed
  -- amount must be a positive number of piastres.
  CONSTRAINT "Discount_value_chk" CHECK (
    ("kind" = 'PERCENT' AND "value" BETWEEN 1 AND 100)
    OR
    ("kind" = 'FIXED' AND "value" > 0)
  ),
  CONSTRAINT "Discount_window_chk" CHECK (
    "startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt"
  ),
  CONSTRAINT "Discount_counts_chk" CHECK (
    "redemptionCount" >= 0
    AND ("maxRedemptions"   IS NULL OR "maxRedemptions"   > 0)
    AND ("perCustomerLimit" IS NULL OR "perCustomerLimit" > 0)
  )
);

-- Unique within a business, not globally: two salons may both run
-- "EID20". Postgres treats NULLs as distinct, so any number of
-- code-less promotions coexist under this same index.
CREATE UNIQUE INDEX IF NOT EXISTS "Discount_businessId_code_key"
  ON "Discount"("businessId", "code");
CREATE INDEX IF NOT EXISTS "Discount_businessId_isActive_idx"
  ON "Discount"("businessId", "isActive");

CREATE TABLE IF NOT EXISTS "DiscountRedemption" (
  "id"          TEXT PRIMARY KEY,
  "discountId"  TEXT NOT NULL,
  "bookingId"   TEXT NOT NULL,
  "customerId"  TEXT,
  "amountCents" INTEGER NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiscountRedemption_discountId_fkey"
    FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE CASCADE,
  CONSTRAINT "DiscountRedemption_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE,

  CONSTRAINT "DiscountRedemption_amount_chk" CHECK ("amountCents" > 0)
);

-- One discount per booking, enforced by the database: a booking cannot
-- carry two, and a retried request cannot redeem the same offer twice.
CREATE UNIQUE INDEX IF NOT EXISTS "DiscountRedemption_bookingId_key"
  ON "DiscountRedemption"("bookingId");
CREATE INDEX IF NOT EXISTS "DiscountRedemption_discountId_idx"
  ON "DiscountRedemption"("discountId");
CREATE INDEX IF NOT EXISTS "DiscountRedemption_customerId_idx"
  ON "DiscountRedemption"("customerId");

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "discountCents" INTEGER NOT NULL DEFAULT 0;
