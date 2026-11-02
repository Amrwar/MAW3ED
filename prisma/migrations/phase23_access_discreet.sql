-- Phase 23 follow-up (P23-A5): a business can keep its name off a
-- venue's security desk. Safe to run twice; run BEFORE deploying the code
-- that reads it.
--
-- Additive and nullable: NULL means "the default for the business's
-- category" (discreet for medical categories, lib/access/discreet.ts), so
-- no row needs a value written and nothing changes until the code ships.

ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "accessDiscreet" BOOLEAN;
