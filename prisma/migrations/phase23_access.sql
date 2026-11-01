-- Phase 23 (booking QR, visitor passes, provider-neutral access), part 2
-- of 2. Safe to run twice. Run AFTER phase23_access_enums.sql and BEFORE
-- deploying the Phase 23 code.
--
-- Additive: no existing row changes meaning. Every venue starts with
-- visitor passes OFF and no provider, so nothing about entry changes
-- until a platform administrator switches a venue on. No provider row is
-- seeded: the sandbox provider is created only where the code allows it
-- (never in production), and a real provider only once an agreement and
-- a specification exist.

-- 1. Providers (no secrets are stored; see AccessProvider in schema.prisma).
CREATE TABLE IF NOT EXISTS "AccessProvider" (
  "id"        TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "kind"      "AccessProviderKind" NOT NULL,
  "nameAr"    TEXT NOT NULL,
  "nameEn"    TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessProvider_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "AccessProvider" ADD COLUMN IF NOT EXISTS "lastHealthAt" TIMESTAMP(3);
ALTER TABLE "AccessProvider" ADD COLUMN IF NOT EXISTS "lastHealthOk" BOOLEAN;
ALTER TABLE "AccessProvider" ADD COLUMN IF NOT EXISTS "lastHealthDetail" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AccessProvider_slug_key" ON "AccessProvider" ("slug");

-- 2. The venue's switch, its reference at the provider, and its policy.
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "accessProviderId" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "accessSiteRef" TEXT;
ALTER TABLE "Venue" ADD COLUMN IF NOT EXISTS "accessEnabled" BOOLEAN NOT NULL DEFAULT false;
DO $$ BEGIN ALTER TABLE "Venue" ADD CONSTRAINT "Venue_accessProviderId_fkey" FOREIGN KEY ("accessProviderId") REFERENCES "AccessProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- Switched on only with a provider.
DO $$ BEGIN ALTER TABLE "Venue" ADD CONSTRAINT "Venue_access_provider_chk" CHECK (NOT "accessEnabled" OR "accessProviderId" IS NOT NULL); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "VenuePolicy" ADD COLUMN IF NOT EXISTS "identityRequirement" "AccessIdentityRequirement" NOT NULL DEFAULT 'NAME';
ALTER TABLE "VenuePolicy" ADD COLUMN IF NOT EXISTS "lateEntryCutoffMinutes" INTEGER;
ALTER TABLE "VenuePolicy" ADD COLUMN IF NOT EXISTS "noShowRevokeMinutes" INTEGER;
ALTER TABLE "VenuePolicy" ADD COLUMN IF NOT EXISTS "escalationContact" TEXT;
DO $$ BEGIN
  ALTER TABLE "VenuePolicy" ADD CONSTRAINT "VenuePolicy_access_minutes_chk" CHECK (
    ("lateEntryCutoffMinutes" IS NULL OR "lateEntryCutoffMinutes" BETWEEN 0 AND 720) AND
    ("noShowRevokeMinutes" IS NULL OR "noShowRevokeMinutes" BETWEEN 0 AND 720));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Visitors and guests.
CREATE TABLE IF NOT EXISTS "Visitor" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT,
  "displayName" TEXT NOT NULL,
  "phoneE164"   TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Visitor_userId_idx" ON "Visitor" ("userId");

CREATE TABLE IF NOT EXISTS "BookingGuest" (
  "id"          TEXT NOT NULL,
  "bookingId"   TEXT NOT NULL,
  "visitorId"   TEXT NOT NULL,
  "role"        "BookingGuestRole" NOT NULL,
  "inviteToken" TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt"   TIMESTAMP(3),
  CONSTRAINT "BookingGuest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookingGuest_inviteToken_key" ON "BookingGuest" ("inviteToken");
CREATE INDEX IF NOT EXISTS "BookingGuest_bookingId_idx" ON "BookingGuest" ("bookingId");
-- One holder per booking.
CREATE UNIQUE INDEX IF NOT EXISTS "BookingGuest_one_holder_key" ON "BookingGuest" ("bookingId") WHERE "role" = 'HOLDER';
DO $$ BEGIN ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "BookingGuest" ADD CONSTRAINT "BookingGuest_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Entitlements (permission to request entry).
CREATE TABLE IF NOT EXISTS "AccessEntitlement" (
  "id"             TEXT NOT NULL,
  "bookingGuestId" TEXT NOT NULL,
  "bookingId"      TEXT NOT NULL,
  "venueId"        TEXT NOT NULL,
  "visitorId"      TEXT NOT NULL,
  "status"         "EntitlementStatus" NOT NULL,
  "validFrom"      TIMESTAMP(3) NOT NULL,
  "validUntil"     TIMESTAMP(3) NOT NULL,
  "entryUntil"     TIMESTAMP(3),
  "allowedGateIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "reentryAllowed" BOOLEAN NOT NULL DEFAULT false,
  "version"        INTEGER NOT NULL DEFAULT 1,
  "reason"         TEXT,
  "overriddenById" TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessEntitlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AccessEntitlement_window_chk" CHECK ("validUntil" > "validFrom")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccessEntitlement_bookingGuestId_key" ON "AccessEntitlement" ("bookingGuestId");
CREATE INDEX IF NOT EXISTS "AccessEntitlement_venueId_validFrom_idx" ON "AccessEntitlement" ("venueId", "validFrom");
CREATE INDEX IF NOT EXISTS "AccessEntitlement_bookingId_idx" ON "AccessEntitlement" ("bookingId");
-- The cron's round-robin (lib/access/reconcile.ts step 1).
CREATE INDEX IF NOT EXISTS "AccessEntitlement_status_validUntil_idx" ON "AccessEntitlement" ("status", "validUntil");
CREATE INDEX IF NOT EXISTS "AccessEntitlement_status_updatedAt_idx" ON "AccessEntitlement" ("status", "updatedAt");
DO $$ BEGIN ALTER TABLE "AccessEntitlement" ADD CONSTRAINT "AccessEntitlement_bookingGuestId_fkey" FOREIGN KEY ("bookingGuestId") REFERENCES "BookingGuest"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AccessEntitlement" ADD CONSTRAINT "AccessEntitlement_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AccessEntitlement" ADD CONSTRAINT "AccessEntitlement_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. Credentials (issued through a provider).
CREATE TABLE IF NOT EXISTS "AccessCredential" (
  "id"               TEXT NOT NULL,
  "entitlementId"    TEXT NOT NULL,
  "providerId"       TEXT NOT NULL,
  "status"           "CredentialStatus" NOT NULL DEFAULT 'PENDING_PROVIDER',
  "providerRef"      TEXT,
  "correlationId"    TEXT NOT NULL,
  "version"          INTEGER NOT NULL DEFAULT 1,
  "confirmedVersion" INTEGER,
  "tokenCiphertext"  TEXT,
  "tokenHash"        TEXT,
  "displayFormat"    TEXT,
  "confirmedAt"      TIMESTAMP(3),
  "revokedAt"        TIMESTAMP(3),
  "expiresAt"        TIMESTAMP(3),
  "lastError"        TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessCredential_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccessCredential_providerId_providerRef_key" ON "AccessCredential" ("providerId", "providerRef");
CREATE INDEX IF NOT EXISTS "AccessCredential_entitlementId_idx" ON "AccessCredential" ("entitlementId");
CREATE INDEX IF NOT EXISTS "AccessCredential_status_idx" ON "AccessCredential" ("status");
-- At most one live credential per entitlement: concurrent issuance cannot make two.
CREATE UNIQUE INDEX IF NOT EXISTS "AccessCredential_one_live_key" ON "AccessCredential" ("entitlementId")
  WHERE "status" IN ('PENDING_PROVIDER', 'ACTIVE', 'REVOKE_PENDING');
DO $$ BEGIN ALTER TABLE "AccessCredential" ADD CONSTRAINT "AccessCredential_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "AccessEntitlement"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AccessCredential" ADD CONSTRAINT "AccessCredential_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AccessProvider"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AccessRevocation" (
  "id"            TEXT NOT NULL,
  "credentialId"  TEXT NOT NULL,
  "reason"        TEXT NOT NULL,
  "requestedById" TEXT,
  "requestedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt"   TIMESTAMP(3),
  CONSTRAINT "AccessRevocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AccessRevocation_credentialId_idx" ON "AccessRevocation" ("credentialId");
DO $$ BEGIN ALTER TABLE "AccessRevocation" ADD CONSTRAINT "AccessRevocation_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AccessCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Provider calls, retried until acknowledged.
CREATE TABLE IF NOT EXISTS "AccessSyncJob" (
  "id"             TEXT NOT NULL,
  "credentialId"   TEXT NOT NULL,
  "kind"           "AccessJobKind" NOT NULL,
  "status"         "AccessJobStatus" NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT NOT NULL,
  "correlationId"  TEXT NOT NULL,
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leasedUntil"    TIMESTAMP(3),
  "lastError"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessSyncJob_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccessSyncJob_idempotencyKey_key" ON "AccessSyncJob" ("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AccessSyncJob_status_nextAttemptAt_idx" ON "AccessSyncJob" ("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "AccessSyncJob_credentialId_idx" ON "AccessSyncJob" ("credentialId");
DO $$ BEGIN ALTER TABLE "AccessSyncJob" ADD CONSTRAINT "AccessSyncJob_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AccessCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 7. The audit trail.
CREATE TABLE IF NOT EXISTS "AccessEvent" (
  "id"              TEXT NOT NULL,
  "venueId"         TEXT NOT NULL,
  "providerId"      TEXT,
  "credentialId"    TEXT,
  "entitlementId"   TEXT,
  "gateId"          TEXT,
  "kind"            "AccessEventKind" NOT NULL,
  "providerEventId" TEXT,
  "occurredAt"      TIMESTAMP(3) NOT NULL,
  "receivedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reason"          TEXT,
  "actorUserId"     TEXT,
  "correlationId"   TEXT,
  "details"         JSONB,
  CONSTRAINT "AccessEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "AccessEvent_providerId_providerEventId_key" ON "AccessEvent" ("providerId", "providerEventId");
CREATE INDEX IF NOT EXISTS "AccessEvent_venueId_occurredAt_idx" ON "AccessEvent" ("venueId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AccessEvent_credentialId_idx" ON "AccessEvent" ("credentialId");
-- "Has anyone on this booking been let in?" — every syncBookingAccess.
CREATE INDEX IF NOT EXISTS "AccessEvent_entitlementId_kind_idx" ON "AccessEvent" ("entitlementId", "kind");
DO $$ BEGIN ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "AccessProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "AccessEvent" ADD CONSTRAINT "AccessEvent_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AccessCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 8. The sandbox provider's own store (an imitation external system).
CREATE TABLE IF NOT EXISTS "SandboxAccessPass" (
  "id"          TEXT NOT NULL,
  "providerRef" TEXT NOT NULL,
  "externalRef" TEXT NOT NULL,
  "tokenHash"   TEXT NOT NULL,
  "holderLabel" TEXT NOT NULL,
  "validFrom"   TIMESTAMP(3) NOT NULL,
  "validUntil"  TIMESTAMP(3) NOT NULL,
  "entryUntil"  TIMESTAMP(3),
  "gateCodes"   TEXT[] DEFAULT ARRAY[]::TEXT[],
  "reentry"     BOOLEAN NOT NULL DEFAULT false,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "version"     INTEGER NOT NULL DEFAULT 1,
  "inside"      BOOLEAN NOT NULL DEFAULT false,
  "entries"     INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SandboxAccessPass_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "SandboxAccessPass" ADD COLUMN IF NOT EXISTS "siteRef" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "SandboxAccessPass_providerRef_key" ON "SandboxAccessPass" ("providerRef");
CREATE UNIQUE INDEX IF NOT EXISTS "SandboxAccessPass_tokenHash_key" ON "SandboxAccessPass" ("tokenHash");

CREATE TABLE IF NOT EXISTS "SandboxProviderState" (
  "id"        TEXT NOT NULL DEFAULT 'default',
  "mode"      TEXT NOT NULL DEFAULT 'NORMAL',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SandboxProviderState_pkey" PRIMARY KEY ("id")
);

-- 9. The booking's own check-in code (QR type B). Only the nonce and the
-- code's hash are stored; the code itself is derived with a server key.
CREATE TABLE IF NOT EXISTS "BookingCheckIn" (
  "id"            TEXT NOT NULL,
  "bookingId"     TEXT NOT NULL,
  "nonce"         TEXT NOT NULL,
  "tokenHash"     TEXT NOT NULL,
  "status"        "CheckInStatus" NOT NULL DEFAULT 'ACTIVE',
  "issuedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "generation"    INTEGER NOT NULL DEFAULT 1,
  "revokedAt"     TIMESTAMP(3),
  "revokedReason" TEXT,
  "checkedInAt"   TIMESTAMP(3),
  "checkedInById" TEXT,
  "lastScanAt"    TIMESTAMP(3),
  "scanCount"     INTEGER NOT NULL DEFAULT 0,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BookingCheckIn_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BookingCheckIn_bookingId_key" ON "BookingCheckIn" ("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingCheckIn_tokenHash_key" ON "BookingCheckIn" ("tokenHash");
DO $$ BEGIN ALTER TABLE "BookingCheckIn" ADD CONSTRAINT "BookingCheckIn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
