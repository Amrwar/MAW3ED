-- Phase 22 final (relationship semantics), part 1 of 2: enum values.
-- Safe to run twice. Run BEFORE phase22c_relationships.sql, and both
-- BEFORE deploying the code that uses them.
--
-- Kept apart from part 2 because PostgreSQL cannot use an enum value in
-- the same transaction that added it, and a multi-statement script runs
-- as one implicit transaction.

ALTER TYPE "OrganizationKind" ADD VALUE IF NOT EXISTS 'RESTAURANT_GROUP';
ALTER TYPE "OrganizationKind" ADD VALUE IF NOT EXISTS 'CLINIC_GROUP';
ALTER TYPE "OrganizationBusinessRelation" ADD VALUE IF NOT EXISTS 'HOSTED';
ALTER TYPE "OrganizationBusinessRelation" ADD VALUE IF NOT EXISTS 'MANAGED';
ALTER TYPE "OrganizationBusinessStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
DO $$ BEGIN
  CREATE TYPE "DelegationScope" AS ENUM ('RESERVATIONS', 'CUSTOMERS', 'SERVICES', 'STAFF', 'SCHEDULES', 'PROFILE', 'REPORTS', 'FINANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
