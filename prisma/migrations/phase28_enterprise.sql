-- Phase 28: enterprise integrations (API clients, webhooks), organization
-- contracts, scheduled-job runs, per-venue provider credentials, brand colour.
--
-- Additive and idempotent: safe to run twice. Run BEFORE the Phase 28 code
-- deploys. docs/enterprise/ARCHITECTURE.md.

-- ─── Enums ──────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "ApiClientStatus" AS ENUM ('ACTIVE', 'REVOKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WebhookEndpointStatus" AS ENUM ('ACTIVE', 'DISABLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'DEAD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Organization brand colour ──────────────────────────────────────────────
ALTER TABLE "VenueOrganization" ADD COLUMN IF NOT EXISTS "brandColor" TEXT;
DO $$ BEGIN
  ALTER TABLE "VenueOrganization" ADD CONSTRAINT "VenueOrganization_brandColor_chk" CHECK ("brandColor" IS NULL OR "brandColor" ~ '^#[0-9A-Fa-f]{6}$');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Booking change feed ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "Booking_businessId_updatedAt_id_idx" ON "Booking"("businessId", "updatedAt", "id");

-- ─── API clients ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ApiClient" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" TEXT NOT NULL,
  "keyPrefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "ApiClientStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "replacedById" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  -- A key hash is 64 hex characters; a revoked client says when.
  CONSTRAINT "ApiClient_hash_chk" CHECK ("keyHash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "ApiClient_revoked_chk" CHECK (("status" = 'REVOKED') = ("revokedAt" IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApiClient_keyPrefix_key" ON "ApiClient"("keyPrefix");
CREATE INDEX IF NOT EXISTS "ApiClient_organizationId_status_idx" ON "ApiClient"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "ApiUsageDay" (
  "clientId" TEXT NOT NULL REFERENCES "ApiClient"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "day" DATE NOT NULL,
  "requests" INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("clientId", "day")
);

-- ─── Webhooks ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "WebhookEndpoint" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "url" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "WebhookEndpointStatus" NOT NULL DEFAULT 'ACTIVE',
  "secretSealed" TEXT NOT NULL,
  "previousSecretSealed" TEXT,
  "previousSecretUntil" TIMESTAMP(3),
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "disabledReason" TEXT,
  "lastSuccessAt" TIMESTAMP(3),
  "lastFailureAt" TIMESTAMP(3),
  "cursorAt" TIMESTAMP(3),
  "cursorId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  -- HTTPS is enforced by the application (plain HTTP only in local tests,
  -- never on Vercel); the address is checked again before every send (SSRF).
  CONSTRAINT "WebhookEndpoint_url_chk" CHECK ("url" ~ '^https?://' AND length("url") <= 500),
  CONSTRAINT "WebhookEndpoint_failures_chk" CHECK ("consecutiveFailures" >= 0)
);
ALTER TABLE "WebhookEndpoint" DROP CONSTRAINT IF EXISTS "WebhookEndpoint_url_chk";
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_url_chk" CHECK ("url" ~ '^https?://' AND length("url") <= 500);
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_organizationId_idx" ON "WebhookEndpoint"("organizationId");
CREATE INDEX IF NOT EXISTS "WebhookEndpoint_status_idx" ON "WebhookEndpoint"("status");

CREATE TABLE IF NOT EXISTS "WebhookDelivery" (
  "id" TEXT PRIMARY KEY,
  "endpointId" TEXT NOT NULL REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "lastStatusCode" INTEGER,
  "lastError" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  -- Bounded retries (lib/enterprise/webhooks MAX_ATTEMPTS = 8).
  CONSTRAINT "WebhookDelivery_attempts_chk" CHECK ("attempts" BETWEEN 0 AND 8)
);
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_endpointId_eventId_key" ON "WebhookDelivery"("endpointId", "eventId");
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_nextAttemptAt_idx" ON "WebhookDelivery"("status", "nextAttemptAt");

-- ─── Contracts ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "OrganizationContract" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reference" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3),
  "maxApiClients" INTEGER NOT NULL DEFAULT 2,
  "maxWebhooks" INTEGER NOT NULL DEFAULT 2,
  "apiRequestsPerMinute" INTEGER NOT NULL DEFAULT 120,
  "notes" TEXT,
  "setById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationContract_limits_chk" CHECK (
    "maxApiClients" BETWEEN 0 AND 20 AND "maxWebhooks" BETWEEN 0 AND 20
    AND "apiRequestsPerMinute" BETWEEN 10 AND 6000
    AND ("endsAt" IS NULL OR "endsAt" > "startsAt"))
);
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationContract_organizationId_key" ON "OrganizationContract"("organizationId");

-- ─── Scheduled-job runs ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CronRun" (
  "id" TEXT PRIMARY KEY,
  "job" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "ok" BOOLEAN,
  "summary" JSONB,
  "error" TEXT
);
CREATE INDEX IF NOT EXISTS "CronRun_job_startedAt_idx" ON "CronRun"("job", "startedAt");

-- ─── Per-venue provider credentials ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "VenueAccessCredential" (
  "id" TEXT PRIMARY KEY,
  "venueId" TEXT NOT NULL REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "providerId" TEXT NOT NULL REFERENCES "AccessProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "secretSealed" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL DEFAULT 1,
  "rotatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VenueAccessCredential_version_chk" CHECK ("keyVersion" >= 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS "VenueAccessCredential_venueId_key" ON "VenueAccessCredential"("venueId");
CREATE INDEX IF NOT EXISTS "VenueAccessCredential_providerId_idx" ON "VenueAccessCredential"("providerId");
