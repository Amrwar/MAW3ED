-- Phase 27, part 1 of 2: new values on an existing enum.
--
-- Run BEFORE phase27_operations.sql, as its own statement batch: a value
-- added to an enum cannot be used (in a CHECK constraint) in the same
-- transaction that adds it. Additive and idempotent.
ALTER TYPE "PaymentKind" ADD VALUE IF NOT EXISTS 'PACKAGE';
ALTER TYPE "PaymentKind" ADD VALUE IF NOT EXISTS 'MEMBERSHIP';
