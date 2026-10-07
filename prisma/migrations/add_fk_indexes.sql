-- Indexes on foreign keys that had none.
--
-- Postgres does not index a referencing column automatically. Without
-- one, deleting or updating the parent row sequentially scans the whole
-- child table to check the constraint, and every join across that key
-- does the same. Thirteen keys were missing theirs.
--
-- Nothing here changes behaviour; these only remove work. They are
-- CONCURRENTLY-free because the tables are small today and the lock is
-- measured in milliseconds — worth revisiting if any of them grows past
-- a few hundred thousand rows.
--
-- Left alone on purpose:
--   Business.cityId / categoryId / neighborhoodId already sit inside
--   composite indexes led by isPublished, which serve every read the
--   discovery pages make. A city or a category is deleted roughly
--   never, so the scan these would save is one nobody waits on.
--   neon_auth.invitation.inviterId belongs to Neon, not to us.

-- Auth tables: scanned whenever a user is deleted.
CREATE INDEX IF NOT EXISTS "Account_userId_idx"  ON "Account"("userId");
CREATE INDEX IF NOT EXISTS "Session_userId_idx"  ON "Session"("userId");

-- Scanned whenever a business is deleted, and both will grow with use.
CREATE INDEX IF NOT EXISTS "Favorite_businessId_idx" ON "Favorite"("businessId");
CREATE INDEX IF NOT EXISTS "Table_businessId_idx"    ON "Table"("businessId");

-- Scanned whenever a service is deleted, which owners do routinely.
CREATE INDEX IF NOT EXISTS "StaffService_serviceId_idx" ON "StaffService"("serviceId");

-- Scanned whenever a branch is deleted.
CREATE INDEX IF NOT EXISTS "TimeBlock_branchId_idx" ON "TimeBlock"("branchId");

-- From the payments phase: scanned whenever a user is deleted, against
-- the two tables that will grow fastest once money is moving.
CREATE INDEX IF NOT EXISTS "Payment_recordedById_idx" ON "Payment"("recordedById");
CREATE INDEX IF NOT EXISTS "Refund_actorId_idx"       ON "Refund"("actorId");

-- Self-referencing: scanned whenever any business is deleted.
CREATE INDEX IF NOT EXISTS "Business_referredById_idx" ON "Business"("referredById");
