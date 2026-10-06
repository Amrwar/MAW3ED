-- Part two of the booking-engine migration.
--
-- Split from part one because PostgreSQL will not let a statement use an
-- enum value that was added in the same transaction, and the exclusion
-- constraint below names ARRIVED and IN_PROGRESS in its WHERE clause.

-- ── Backfill the interval columns ───────────────────────────────────
--
-- A booking stores a date at UTC midnight plus "HH:MM" wall-clock
-- strings. startsAt/endsAt express the same appointment as an interval
-- so the database can reason about overlap. endTime has been written
-- since the current booking flow was built; older rows fall back to
-- startTime plus the service duration, which is the same rule the
-- application has always applied when endTime was missing.
UPDATE "Booking" b
SET "startsAt" = b."date" + (b."startTime")::interval,
    "endsAt"   = b."date" + COALESCE(
                   (b."endTime")::interval,
                   (b."startTime")::interval + (s."duration" || ' minutes')::interval
                 )
FROM "Service" s
WHERE s."id" = b."serviceId"
  AND b."startsAt" IS NULL;

-- ── Booking references ──────────────────────────────────────────────
--
-- MWD- plus five characters from an alphabet with no 0/O/1/I/L, so a
-- reference read down the phone cannot be mistyped into another one.
-- Generated in the database for existing rows; new rows get theirs from
-- lib/bookings/reference.ts, which uses the same alphabet.
DO $$
DECLARE
  r RECORD;
  candidate TEXT;
  alphabet  TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  i INT;
BEGIN
  FOR r IN SELECT "id" FROM "Booking" WHERE "reference" IS NULL LOOP
    LOOP
      candidate := 'MWD-';
      FOR i IN 1..5 LOOP
        candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      END LOOP;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM "Booking" WHERE "reference" = candidate);
    END LOOP;
    UPDATE "Booking" SET "reference" = candidate WHERE "id" = r."id";
  END LOOP;
END $$;

-- ── Double booking, prevented by the database ───────────────────────
--
-- The application still checks for a conflict before inserting, because
-- a friendly Arabic message beats a constraint violation. This is what
-- holds when two requests pass that check at the same instant: one
-- commits, the other is rejected by Postgres and retried as a 409.
--
-- Scoping mirrors the application rule exactly. A booking against a
-- named staff member or table only collides with others against the
-- same one, so several barbers or tables run in parallel; a booking
-- with neither collides with every other unscoped booking for that
-- business, which is how a single-room clinic behaves today.
--
-- Only live statuses participate. A cancelled or completed appointment
-- must not keep holding its slot.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" DROP CONSTRAINT IF EXISTS "booking_no_overlap";

ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_overlap"
EXCLUDE USING gist (
  "businessId" WITH =,
  COALESCE("staffMemberId", '-') WITH =,
  COALESCE("tableId", '-') WITH =,
  tsrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE (
  "startsAt" IS NOT NULL
  AND "endsAt" IS NOT NULL
  AND "endsAt" > "startsAt"
  AND "status" IN ('PENDING_PAYMENT', 'PENDING', 'CONFIRMED', 'ARRIVED', 'IN_PROGRESS')
);
