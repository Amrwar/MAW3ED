-- Making a customer's bookings findable from their account.
--
-- A booking stores the phone exactly as the customer typed it —
-- "01107578212", "+20 110 757 8212", "(011) 0757-8212" are all accepted
-- and all stored verbatim, which is right: it is what the business sees
-- and dials. But an account's phone is canonical ("201107578212"), so
-- matching the two directly finds nothing, and every customer who signed
-- in would be shown an empty account.
--
-- This adds the canonical form as a GENERATED column rather than a
-- normal one deliberately. Postgres computes it, so no insert path can
-- forget to set it and the two can never drift apart — and the column
-- the business reads is untouched.
--
-- The CASE mirrors normaliseEgyptianMobile() in src/lib/verification.ts
-- exactly: strip everything that is not a digit, accept a 20-, 0- or
-- bare-prefixed number, require a real Egyptian mobile (1 then 0/1/2/5
-- then eight digits), and store "20" + the ten local digits. Anything
-- that is not an Egyptian mobile becomes NULL, which matches no account.

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "customerPhoneE164" TEXT
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

-- Every account page filters on this, so it needs to be indexed.
CREATE INDEX IF NOT EXISTS "Booking_customerPhoneE164_idx"
  ON "Booking" ("customerPhoneE164");

-- The upcoming/history split orders by the appointment instant within
-- one customer, which this serves directly.
CREATE INDEX IF NOT EXISTS "Booking_customerPhoneE164_startsAt_idx"
  ON "Booking" ("customerPhoneE164", "startsAt");
