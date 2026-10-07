-- A rate-limit counter that works when the app is deployed serverlessly.
--
-- An in-memory limiter is worse than none here, because it reads as
-- protection and is not: Vercel runs many instances and recycles them,
-- so a Map hands an attacker the whole limit per instance per cold
-- start. Postgres is the one thing every instance shares.
--
-- Fixed window rather than sliding. A sliding window needs a row per
-- attempt and is more precise; a fixed window needs one row per window,
-- and its worst case — twice the limit across a boundary — does not
-- matter when the limit is eight logins in fifteen minutes.
--
-- The key holds a HASH of what is being limited, never the value. A
-- table naming the addresses and emails that tried to sign in would be
-- a worse disclosure than the brute force it exists to stop.

CREATE TABLE IF NOT EXISTS "RateLimit" (
  "key"       TEXT PRIMARY KEY,
  "count"     INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

-- For the prune. Without it, clearing expired windows scans the table.
CREATE INDEX IF NOT EXISTS "RateLimit_expiresAt_idx" ON "RateLimit"("expiresAt");
