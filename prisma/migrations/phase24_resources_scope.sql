-- Phase 24: a delegation scope for tables, rooms, chairs and equipment.
--
-- A restaurant group running its brands needs their tables; until now
-- resources were the owner's alone and no scope covered them. A new value
-- rather than a wider existing scope, so no grant an owner already gave
-- means more than it did. Additive; nothing is granted by this migration.
-- Idempotent. Run BEFORE the Phase 24 code deploys.
ALTER TYPE "DelegationScope" ADD VALUE IF NOT EXISTS 'RESOURCES' AFTER 'STAFF';
