-- Phone numbers from any country.
--
-- Booking."customerPhoneE164" is how a customer's bookings find their
-- account: the account pages, reviews, payments and in-app notifications
-- all match on it. It recognised Egyptian mobiles only, so a customer
-- from anywhere else could sign in and see an empty account.
--
-- The rules now live in one function, maw3ed_normalise_phone(), which is
-- src/lib/phone.ts normalisePhone() written in SQL — the same cases,
-- checked against each other by src/lib/phone-sql.test.ts. Egyptian
-- numbers normalise exactly as before, so every existing match holds.
--
-- Safe to run twice: the column is rebuilt only if it is not already
-- computed by the function.

CREATE OR REPLACE FUNCTION maw3ed_normalise_phone(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $fn$
  SELECT CASE
    -- Egypt, written locally: 01012345678 or 1012345678.
    WHEN NOT intl AND d ~ '^01[0125][0-9]{8}$' THEN '20' || substr(d, 2)
    WHEN NOT intl AND d ~ '^1[0125][0-9]{8}$' THEN '20' || d
    -- Egypt with its country code, including "+20 010…". Mobiles only.
    WHEN d ~ '^201[0125][0-9]{8}$' THEN d
    WHEN d ~ '^2001[0125][0-9]{8}$' THEN '20' || substr(d, 4)
    WHEN d ~ '^20' THEN NULL
    -- Everywhere else: a country code is required, 8 to 15 digits.
    WHEN (intl OR length(d) >= 11) AND d ~ '^[1-9][0-9]{7,14}$' THEN d
    ELSE NULL
  END
  FROM (
    SELECT
      t ~ '^(\+|00)' AS intl,
      CASE
        WHEN t ~ '^00' THEN substr(regexp_replace(t, '\D', '', 'g'), 3)
        ELSE regexp_replace(t, '\D', '', 'g')
      END AS d
    FROM (
      -- JavaScript's trim(): every kind of space, not only ' ' as btrim()
      -- strips — a pasted tab or no-break space must not hide a leading +.
      SELECT regexp_replace(raw, '^[\s\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+', '') AS t
    ) AS trimmed
  ) AS parts
$fn$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'Booking'
       AND column_name = 'customerPhoneE164'
       AND is_generated = 'ALWAYS'
       AND generation_expression LIKE '%maw3ed_normalise_phone%'
  ) THEN
    -- A generated expression cannot be altered in place: drop and re-add.
    -- Nothing is lost — every value is recomputed from customerPhone.
    DROP INDEX IF EXISTS "Booking_customerPhoneE164_startsAt_idx";
    DROP INDEX IF EXISTS "Booking_customerPhoneE164_idx";
    ALTER TABLE "Booking" DROP COLUMN IF EXISTS "customerPhoneE164";
    ALTER TABLE "Booking"
      ADD COLUMN "customerPhoneE164" TEXT
      GENERATED ALWAYS AS (maw3ed_normalise_phone("customerPhone")) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Booking_customerPhoneE164_idx"
  ON "Booking" ("customerPhoneE164");
CREATE INDEX IF NOT EXISTS "Booking_customerPhoneE164_startsAt_idx"
  ON "Booking" ("customerPhoneE164", "startsAt");
