-- Phase 20: security and privacy hardening. Safe to run twice.
-- RUN BEFORE DEPLOYING the Phase 20 code: sign-in reads the new User
-- columns on every session check.
--
-- 1. User."sessionsRevokedAt": web sessions are JSON Web Tokens and
--    could not be ended early. A password reset or "sign out everywhere"
--    sets this; every token signed in before it is refused on its next
--    check (src/lib/security/session-policy.ts).
--
-- 2. User."historySince" and "PhoneRelease": when a customer deletes
--    their account the bookings stay with the businesses, keyed by the
--    phone number. Numbers are recycled, so the next person to verify
--    that number used to be shown the previous holder's appointments.
--    Deletion now records a keyed hash of the number; an account created
--    for it later sees only bookings made after the release.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionsRevokedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "historySince"      TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "PhoneRelease" (
  "id"         TEXT NOT NULL,
  "phoneHash"  TEXT NOT NULL,
  "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneRelease_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PhoneRelease_phoneHash_key" ON "PhoneRelease" ("phoneHash");
