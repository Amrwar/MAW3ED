-- Phase 23 (booking QR, visitor passes, provider-neutral access), part 1
-- of 2: enum values. Safe to run twice. Run BEFORE phase23_access.sql,
-- and both BEFORE deploying the code that uses them.
--
-- Kept apart from part 2 because PostgreSQL cannot use an enum value in
-- the same transaction that added it, and a multi-statement script runs
-- as one implicit transaction.
--
-- VENUE_SECURITY is already admitted by "VenueRole_scope_chk" (Phase 22b
-- wrote that check against the text value), so the check is not touched.

ALTER TYPE "VenueRoleKind" ADD VALUE IF NOT EXISTS 'VENUE_SECURITY';

DO $$ BEGIN CREATE TYPE "AccessProviderKind" AS ENUM ('SANDBOX', 'PARTNER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccessIdentityRequirement" AS ENUM ('NAME', 'NAME_AND_PHONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "BookingGuestRole" AS ENUM ('HOLDER', 'GUEST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "EntitlementStatus" AS ENUM ('ELIGIBLE', 'SUSPENDED', 'REVOKED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CredentialStatus" AS ENUM ('PENDING_PROVIDER', 'ACTIVE', 'REVOKE_PENDING', 'REVOKED', 'EXPIRED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccessJobKind" AS ENUM ('PROVISION', 'UPDATE', 'REVOKE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccessJobStatus" AS ENUM ('PENDING', 'DONE', 'DEAD'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "AccessEventKind" AS ENUM ('CREDENTIAL_ACTIVE', 'CREDENTIAL_UPDATED', 'CREDENTIAL_REVOKED', 'CREDENTIAL_FAILED', 'ENTRY_GRANTED', 'ENTRY_DENIED', 'EXIT', 'PROVIDER_ERROR', 'OVERRIDE_SUSPEND', 'OVERRIDE_REINSTATE', 'ESCALATION'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CheckInStatus" AS ENUM ('ACTIVE', 'REVOKED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
