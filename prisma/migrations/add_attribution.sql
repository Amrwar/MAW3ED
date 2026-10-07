-- Where visitors come from, and whether they book.
--
-- Nothing in the application recorded a page view, so "is Instagram
-- working for us" had no answer at all — not a poor one, none. This
-- adds the smallest thing that answers it.
--
-- ProfileView is a counter, not a log: one row per business, per
-- source, per day, incremented. A hundred thousand views cost one row.
-- There is no IP, no cookie, no user agent, no device id and no session
-- — not because they were forgotten but because the question worth
-- answering is whether a channel works, and that does not require
-- knowing who walked past. There is nothing here to join to a person.
--
-- Booking.source is nullable and stays null for bookings made before
-- this existed, and for any that arrive without a source. It is never
-- guessed: an unattributed booking counts as unattributed.

DO $$ BEGIN
  CREATE TYPE "TrafficSource" AS ENUM (
    'DIRECT',     -- typed, bookmarked, or no referrer
    'INSTAGRAM',
    'WHATSAPP',
    'FACEBOOK',
    'GOOGLE',     -- including the Google Business Profile link
    'WEBSITE',    -- the business's own site
    'QR',         -- a printed code in the shop
    'MAW3ED',     -- browsing inside the marketplace
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProfileView" (
  "id"         TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "source"     "TrafficSource" NOT NULL,
  -- A bare date, not a timestamp: the grain is a day in Cairo.
  "day"        DATE NOT NULL,
  "count"      INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "ProfileView_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE,

  CONSTRAINT "ProfileView_count_chk" CHECK ("count" >= 0)
);

-- The upsert target. Without this unique key the "increment the day's
-- counter" write becomes a read-then-write and two visitors landing at
-- the same moment lose one of the views.
CREATE UNIQUE INDEX IF NOT EXISTS "ProfileView_businessId_source_day_key"
  ON "ProfileView"("businessId", "source", "day");

CREATE INDEX IF NOT EXISTS "ProfileView_businessId_day_idx"
  ON "ProfileView"("businessId", "day");

-- Attribution on the booking itself, so conversion is a join rather
-- than a guess about timing.
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "source" "TrafficSource";

CREATE INDEX IF NOT EXISTS "Booking_businessId_source_idx"
  ON "Booking"("businessId", "source");
