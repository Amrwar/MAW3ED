-- Making the reviews trustworthy.
--
-- A review already had a rating, a comment, a reply and a verified
-- badge. What it had no way to express was that somebody had complained
-- about it, that a moderator had looked, or that it should stop
-- counting — so the only options were to leave a fake review standing
-- or to delete it and lose the evidence.
--
-- The rule everything here serves: a review that is not PUBLISHED does
-- not appear and does not count. The average, the count, the
-- distribution and the list are all drawn from the same set, so the
-- page cannot say "127 reviews" above a list of 126.

DO $$ BEGIN
  CREATE TYPE "ReviewStatus" AS ENUM (
    'PUBLISHED',      -- visible, counts toward the rating
    'UNDER_REVIEW',   -- reported, still visible while somebody looks
    'HIDDEN',         -- not visible, does not count, can be restored
    'REMOVED'         -- withdrawn by its author
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportReason" AS ENUM (
    'INAPPROPRIATE',
    'FAKE',
    'SPAM',
    'HARASSMENT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'UPHELD', 'DISMISSED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── The platform moderator ───────────────────────────────────
-- Set by hand in the database. Deliberately not grantable from
-- anywhere in the application: there is no screen that can make
-- somebody an admin, so there is no screen to get wrong.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- ── The review itself ────────────────────────────────────────
ALTER TABLE "Review"
  ADD COLUMN IF NOT EXISTS "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
  -- Why a moderator did what they did. Never shown publicly; it is for
  -- the next moderator to read, not for the business to argue with.
  ADD COLUMN IF NOT EXISTS "moderationNote" TEXT,
  ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "moderatedById" TEXT,
  -- Set the first time the author changes it, so the page can say the
  -- review was edited rather than quietly showing different words.
  ADD COLUMN IF NOT EXISTS "editedAt" TIMESTAMP(3),
  -- Denormalised so "most helpful" can be an index scan rather than a
  -- count per row. ReviewVote is the truth; this follows it.
  ADD COLUMN IF NOT EXISTS "helpfulCount" INTEGER NOT NULL DEFAULT 0,
  -- Photos the customer attached, as Cloudinary URLs.
  ADD COLUMN IF NOT EXISTS "photos" TEXT[] NOT NULL DEFAULT '{}';

-- Every public query filters on status, so it belongs in the indexes
-- that serve them.
CREATE INDEX IF NOT EXISTS "Review_businessId_status_createdAt_idx"
  ON "Review" ("businessId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "Review_businessId_status_rating_idx"
  ON "Review" ("businessId", "status", "rating");
CREATE INDEX IF NOT EXISTS "Review_businessId_status_helpful_idx"
  ON "Review" ("businessId", "status", "helpfulCount");
CREATE INDEX IF NOT EXISTS "Review_status_idx" ON "Review" ("status");

-- ── Was this review useful? ──────────────────────────────────
-- One vote per review per device. The voter is a hash of the device id
-- and the review id together, so the rows cannot be joined up into a
-- picture of what any one person has read.
CREATE TABLE IF NOT EXISTS "ReviewVote" (
  "id"        TEXT NOT NULL,
  "reviewId"  TEXT NOT NULL,
  "voterHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewVote_reviewId_fkey" FOREIGN KEY ("reviewId")
    REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReviewVote_reviewId_voterHash_key"
  ON "ReviewVote" ("reviewId", "voterHash");

-- ── Somebody complained ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ReviewReport" (
  "id"           TEXT NOT NULL,
  "reviewId"     TEXT NOT NULL,
  "reason"       "ReportReason" NOT NULL,
  -- What they said about it, in their words. Optional.
  "detail"       TEXT,
  -- Hashed, for rate limiting and for spotting one person reporting
  -- everything. Never an address, never a name.
  "reporterHash" TEXT NOT NULL,
  -- Set when a business owner reports a review of their own place, so
  -- a moderator knows who is asking.
  "byBusiness"   BOOLEAN NOT NULL DEFAULT false,
  "status"       "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "resolvedAt"   TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReviewReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId")
    REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ReviewReport_status_createdAt_idx"
  ON "ReviewReport" ("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ReviewReport_reviewId_idx"
  ON "ReviewReport" ("reviewId");
-- One report per reason per person per review: reporting the same
-- thing twice should not make it look twice as bad.
CREATE UNIQUE INDEX IF NOT EXISTS "ReviewReport_reviewId_reporterHash_reason_key"
  ON "ReviewReport" ("reviewId", "reporterHash", "reason");
