-- Phase 17 booking integrity. Safe to run twice.
--
-- RUN BEFORE DEPLOYING the Phase 17 code: it writes and reads
-- Booking."customerEmail", and every booking would fail without it.
--
-- 1. Booking."customerEmail": where a booking's emails go — the address
--    typed with that booking. They used to go to Customer.email, which
--    the first anonymous booking for a phone number could set, so
--    whoever booked first with somebody's number received that person's
--    later confirmations and manage links.
--
--    Backfill: Customer.email is NOT copied — it may be exactly the
--    planted address this closes. Bookings still to come (or finished in
--    the last four days, which may yet be asked for a review) take the
--    email of the account that has proved it owns the booking's phone
--    number, where there is one and its email is confirmed. Everyone
--    else's existing bookings carry on by WhatsApp, in-app and push, and
--    every booking from here on carries the address typed with it.
--
-- 2. Two more overlap constraints, each added only when the data
--    already satisfies it (otherwise a NOTICE says how many rows clash,
--    and the query below lists them):
--
--      booking_no_overlap_resource  one booking per room, chair or table
--                                   at a time, whoever runs it
--      booking_no_overlap_staff     one booking per person at a time,
--                                   whatever room it is in
--
--    The existing booking_no_overlap compares (staff, resource) as a
--    pair, so doctor A in room 1 and doctor B in room 1 at ten passed
--    it. The application now refuses both; these hold it under a race.
--
--    To see the clashes that stopped a constraint:
--
--      SELECT a.id, b.id, a."businessId", a."resourceId", a."staffMemberId", a."startsAt"
--        FROM "Booking" a JOIN "Booking" b
--          ON a."businessId" = b."businessId" AND a.id < b.id
--         AND (a."resourceId" = b."resourceId" OR a."staffMemberId" = b."staffMemberId")
--         AND tsrange(a."startsAt", a."endsAt", '[)') && tsrange(b."startsAt", b."endsAt", '[)')
--       WHERE a.status IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS')
--         AND b.status IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS');

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "customerEmail" TEXT;

UPDATE "Booking" b
   SET "customerEmail" = u.email
  FROM "User" u
 WHERE u.phone = b."customerPhoneE164"
   AND u."phoneVerifiedAt" IS NOT NULL
   AND u."emailVerified" IS NOT NULL
   AND u.email IS NOT NULL
   AND b."customerEmail" IS NULL
   AND b."startsAt" >= now() - interval '4 days';

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE clashes integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_no_overlap_resource') THEN
    SELECT count(*) INTO clashes
      FROM "Booking" a JOIN "Booking" b
        ON a."businessId" = b."businessId" AND a.id < b.id AND a."resourceId" = b."resourceId"
       AND tsrange(a."startsAt", a."endsAt", '[)') && tsrange(b."startsAt", b."endsAt", '[)')
     WHERE a."endsAt" > a."startsAt" AND b."endsAt" > b."startsAt"
       AND a.status IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS')
       AND b.status IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS');
    IF clashes = 0 THEN
      ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_overlap_resource"
        EXCLUDE USING gist ("businessId" WITH =, "resourceId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
        WHERE ("resourceId" IS NOT NULL AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt"
               AND "status" IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS'));
    ELSE
      RAISE NOTICE 'booking_no_overlap_resource NOT added: % overlapping pair(s) share a resource', clashes;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_no_overlap_staff') THEN
    SELECT count(*) INTO clashes
      FROM "Booking" a JOIN "Booking" b
        ON a."businessId" = b."businessId" AND a.id < b.id AND a."staffMemberId" = b."staffMemberId"
       AND tsrange(a."startsAt", a."endsAt", '[)') && tsrange(b."startsAt", b."endsAt", '[)')
     WHERE a."endsAt" > a."startsAt" AND b."endsAt" > b."startsAt"
       AND a.status IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS')
       AND b.status IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS');
    IF clashes = 0 THEN
      ALTER TABLE "Booking" ADD CONSTRAINT "booking_no_overlap_staff"
        EXCLUDE USING gist ("businessId" WITH =, "staffMemberId" WITH =, tsrange("startsAt", "endsAt", '[)') WITH &&)
        WHERE ("staffMemberId" IS NOT NULL AND "startsAt" IS NOT NULL AND "endsAt" IS NOT NULL AND "endsAt" > "startsAt"
               AND "status" IN ('PENDING_PAYMENT','PENDING','CONFIRMED','ARRIVED','IN_PROGRESS'));
    ELSE
      RAISE NOTICE 'booking_no_overlap_staff NOT added: % overlapping pair(s) share a staff member', clashes;
    END IF;
  END IF;
END $$;
