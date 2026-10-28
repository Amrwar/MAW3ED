-- Phase 18: an email change has to be confirmed from the new address.
-- Safe to run twice. RUN BEFORE DEPLOYING the Phase 18 code: the
-- account profile route writes the new column.
--
-- 1. EmailVerificationToken."email": the address a link proves when it
--    is not yet the account's. PATCH /api/account/profile used to write
--    any address straight onto User.email, unverified, so anybody with
--    a phone-code account could claim a business owner's address before
--    the owner signed up and end up owning the business
--    (docs/audits/CRITICAL_FINDINGS.md, P17-10).
--
-- 2. One account per address whatever its case. User.email is unique
--    case-sensitively, while sign-in, reset and signup match
--    case-insensitively, so "Owner@x.com" and "owner@x.com" could be two
--    rows that both answer one sign-in. Existing addresses are
--    lower-cased and a unique index on lower(email) added — unless two
--    rows already differ only by case, in which case a NOTICE says so
--    and this query lists them:
--
--      SELECT lower(email), array_agg(id) FROM "User"
--       WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1;
--
--    Prisma cannot express an index on lower(email), so it is not in
--    schema.prisma. `prisma db push` or `prisma migrate diff` against
--    this database would drop it as drift: migrations in this project
--    are hand-written SQL files, applied by hand, and must stay so.

ALTER TABLE "EmailVerificationToken" ADD COLUMN IF NOT EXISTS "email" TEXT;

DO $$
DECLARE dupes integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'User_email_lower_key') THEN
    SELECT count(*) INTO dupes FROM (
      SELECT lower(email) FROM "User" WHERE email IS NOT NULL GROUP BY lower(email) HAVING count(*) > 1
    ) d;
    IF dupes = 0 THEN
      UPDATE "User" SET email = lower(email) WHERE email IS NOT NULL AND email <> lower(email);
      CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower(email));
    ELSE
      RAISE NOTICE 'User_email_lower_key NOT added: % address(es) exist in more than one case', dupes;
    END IF;
  END IF;
END $$;
