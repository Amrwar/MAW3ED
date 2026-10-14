-- Refresh token rotation for the app's MobileSession rows.
--
-- A refresh used to hand out a new pair under the same session and leave
-- the old refresh token working for its full sixty days, so a copied
-- token was as good as the original for as long as the session lived.
-- Now each refresh token carries the generation it was issued at, a
-- refresh advances the generation, and an older token presented again is
-- treated as stolen: the session is revoked.
--
-- DEFAULT 0 is what keeps existing sessions alive across the deploy.
-- Tokens issued before this carry no generation and are read as 0,
-- which matches every existing row, so each is accepted exactly once
-- and rotated from then on.
--
-- Safe to run more than once.

ALTER TABLE "MobileSession" ADD COLUMN IF NOT EXISTS "refreshGeneration" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MobileSession" ADD COLUMN IF NOT EXISTS "rotatedAt" TIMESTAMP(3);
