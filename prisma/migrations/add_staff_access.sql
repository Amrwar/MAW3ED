-- Staff who can sign in to the business's app.
--
-- A staff member was a name on the schedule, with no account. The owner
-- can now give one a phone number and an access level; whoever signs in
-- with that phone (verified by a one-time code) is linked to the staff
-- member and sees the business in the app, within that level:
--
--   MANAGER   every booking and customer of the business, and the
--             day-to-day actions on them (confirm, cancel, reschedule).
--   PROVIDER  only the bookings with them, and the status of those.
--
-- Reports, settings and anything to do with money stay the owner's.
--
-- Clearing the access level or the phone ends access on the very next
-- request (src/lib/business-access.ts reads these on every call).
--
-- Safe to run twice.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffAccess') THEN
    CREATE TYPE "StaffAccess" AS ENUM ('MANAGER', 'PROVIDER');
  END IF;
END $$;

ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "access" "StaffAccess";
-- E.164 digits without the plus, as User.phone (src/lib/phone.ts).
ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "loginPhone" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "userId" TEXT;

-- One staff login per phone and per account, across all businesses: a
-- person signed in as staff is staff at exactly one place.
CREATE UNIQUE INDEX IF NOT EXISTS "StaffMember_loginPhone_key" ON "StaffMember"("loginPhone");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffMember_userId_key" ON "StaffMember"("userId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffMember_userId_fkey') THEN
    ALTER TABLE "StaffMember"
      ADD CONSTRAINT "StaffMember_userId_fkey" FOREIGN KEY ("userId")
      REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
