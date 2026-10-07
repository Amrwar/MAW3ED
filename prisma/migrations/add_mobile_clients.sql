-- Native clients.
--
-- The web signs in with a NextAuth cookie. A native app cannot use one
-- sensibly — a cookie is host-scoped, httpOnly, SameSite, and belongs to
-- a browser's jar rather than to the app — so the app carries bearer
-- tokens and the API learns to accept them alongside the cookie. The
-- same session, reached a second way, not a second auth system.
--
-- MobileSession exists so a refresh token can be revoked. A bearer token
-- that cannot be withdrawn is a password that never expires: signing
-- out, losing a phone, or an admin cutting access all mean deleting a
-- row here, and the next refresh fails however valid the signature.
--
-- DeviceToken is kept apart from it on purpose. A push token outlives a
-- sign-out — the device is still the device — and one person may be
-- signed in on two phones.
--
-- PUSH joins the notification channels. The dispatcher already treats a
-- channel with nothing configured as skipped rather than failed, which
-- is how SMS has sat dormant, so adding the value changes no behaviour
-- until something is wired to send on it.

CREATE TABLE IF NOT EXISTS "MobileSession" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "deviceName" TEXT,
  "platform"   TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"  TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MobileSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "MobileSession_userId_idx"    ON "MobileSession"("userId");
CREATE INDEX IF NOT EXISTS "MobileSession_expiresAt_idx" ON "MobileSession"("expiresAt");

CREATE TABLE IF NOT EXISTS "DeviceToken" (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "platform"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabledAt" TIMESTAMP(3),

  CONSTRAINT "DeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Unique, so a device re-registering updates its row rather than
-- collecting duplicates and being sent to twice.
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceToken_token_key"  ON "DeviceToken"("token");
CREATE INDEX        IF NOT EXISTS "DeviceToken_userId_idx" ON "DeviceToken"("userId");

-- Postgres refuses ALTER TYPE ... ADD VALUE inside a transaction block
-- on older versions, and IF NOT EXISTS makes a re-run harmless.
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'PUSH';
