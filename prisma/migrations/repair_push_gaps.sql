-- Repairs a database built with `prisma db push` instead of migrations.
--
-- The other migrations here guard themselves with CREATE TABLE IF NOT
-- EXISTS and ADD COLUMN IF NOT EXISTS. That is the right instinct and
-- it has a hole: `db push` builds the tables and columns from
-- schema.prisma first, so those guards see something already there and
-- do nothing — including the CHECK constraints written inline in the
-- CREATE TABLE, and the GENERATED expression on a column push created
-- as plain.
--
-- Nothing errors. The database simply comes up quietly wrong, and the
-- way you find out is worse than a failed migration:
--
--   * Payment loses target/amount/refunded CHECKs, so a payment can be
--     written against neither a booking nor a plan, or refunded past
--     what was taken.
--
--   * Booking."customerPhoneE164" exists but is never computed, so it
--     is NULL on every row. Every account page matches bookings on that
--     column, so every customer sees an empty account and nothing in
--     the logs says why.
--
-- Both were observed on a database set up exactly that way. This file
-- is safe to run against any database, including a correct one: each
-- step checks the real catalog rather than trusting that it ran before.

-- ─── Payment CHECK constraints ──────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_target_chk') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_target_chk" CHECK (
      ("kind" = 'SUBSCRIPTION' AND "plan" IS NOT NULL AND "bookingId" IS NULL)
      OR
      ("kind" <> 'SUBSCRIPTION' AND "bookingId" IS NOT NULL)
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_amount_chk') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_chk" CHECK ("amountCents" > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_refunded_chk') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refunded_chk"
      CHECK ("refundedCents" >= 0 AND "refundedCents" <= "amountCents");
  END IF;
END $$;

-- ─── Booking."customerPhoneE164" must be GENERATED ──────────────────
--
-- Dropped and re-added rather than altered: Postgres cannot turn a
-- plain column into a generated one in place. Dropping loses nothing,
-- because the whole point is that the values were never computed.
--
-- The expression matches normaliseEgyptianMobile() in
-- src/lib/verification.ts, same as add_booking_phone_e164.sql.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'Booking'
       AND column_name = 'customerPhoneE164'
       AND is_generated <> 'ALWAYS'
  ) THEN
    ALTER TABLE "Booking" DROP COLUMN "customerPhoneE164";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'Booking' AND column_name = 'customerPhoneE164'
  ) THEN
    ALTER TABLE "Booking"
      ADD COLUMN "customerPhoneE164" TEXT
      GENERATED ALWAYS AS (
        CASE
          WHEN regexp_replace("customerPhone", '\D', '', 'g') ~ '^201[0125][0-9]{8}$'
            THEN regexp_replace("customerPhone", '\D', '', 'g')
          WHEN regexp_replace("customerPhone", '\D', '', 'g') ~ '^01[0125][0-9]{8}$'
            THEN '20' || substr(regexp_replace("customerPhone", '\D', '', 'g'), 2)
          WHEN regexp_replace("customerPhone", '\D', '', 'g') ~ '^1[0125][0-9]{8}$'
            THEN '20' || regexp_replace("customerPhone", '\D', '', 'g')
          ELSE NULL
        END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Booking_customerPhoneE164_idx"
  ON "Booking" ("customerPhoneE164");
