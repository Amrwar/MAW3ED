-- Phase 27, part 2 of 2: advanced bookings, loyalty, packages, memberships,
-- business operations and automations. Run AFTER phase27_enums.sql and
-- BEFORE the Phase 27 code deploys.
--
-- Additive and idempotent: new columns have defaults, new tables start
-- empty, nothing existing changes meaning. The one rewritten rule is
-- Payment_target_chk, which now also admits PACKAGE and MEMBERSHIP payments
-- (each naming what it paid for) — every existing row already satisfies it.
--
-- Balances can only be moved by conditional updates in the application,
-- and the CHECK constraints below are the floor under them: no negative
-- points, no session used beyond what was bought, no visit beyond what a
-- period includes.

-- ─── Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN CREATE TYPE "NoShowAction" AS ENUM ('REQUIRE_DEPOSIT', 'BLOCK_ONLINE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SeriesStatus" AS ENUM ('ACTIVE', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SlotWaitStatus" AS ENUM ('WAITING', 'OFFERED', 'BOOKED', 'EXPIRED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "LoyaltyEntryKind" AS ENUM ('EARN', 'EARN_REVERSAL', 'REDEEM', 'REDEEM_REVERSAL', 'EXPIRE', 'ADJUST'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PackageStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "CustomerMembershipStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CANCELLED', 'EXPIRED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Columns on existing tables ────────────────────────────────────────────
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "seriesId" TEXT,
  ADD COLUMN IF NOT EXISTS "seriesIndex" INTEGER,
  ADD COLUMN IF NOT EXISTS "loyaltyCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "walkIn" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "companions" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Business"
  ADD COLUMN IF NOT EXISTS "noShowLimit" INTEGER,
  ADD COLUMN IF NOT EXISTS "noShowWindowDays" INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS "noShowAction" "NoShowAction" NOT NULL DEFAULT 'REQUIRE_DEPOSIT',
  ADD COLUMN IF NOT EXISTS "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "waitlistOfferMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "maxCompanions" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "followUpEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "followUpDelayHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "rebookReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rebookAfterDays" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "membershipRenewalNoticeDays" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "loyaltyNoticesEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Discount" ADD COLUMN IF NOT EXISTS "organizationPromotionId" TEXT;
ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "customerPackageId" TEXT,
  ADD COLUMN IF NOT EXISTS "customerMembershipId" TEXT;
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "groupName" TEXT;
ALTER TABLE "StaffMember" ADD COLUMN IF NOT EXISTS "commissionPercent" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "marketingConsentAt" TIMESTAMP(3);

-- ─── New tables ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BookingSeries" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "customerId" TEXT,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "staffMemberId" TEXT,
  "resourceId" TEXT,
  "intervalWeeks" INTEGER NOT NULL,
  "occurrences" INTEGER NOT NULL,
  "startDate" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "status" "SeriesStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Bounded generation: every 1-4 weeks, 2-12 times (lib/bookings/series.ts).
  CONSTRAINT "BookingSeries_bounds_chk" CHECK ("intervalWeeks" BETWEEN 1 AND 4 AND "occurrences" BETWEEN 2 AND 12)
);
CREATE INDEX IF NOT EXISTS "BookingSeries_businessId_createdAt_idx" ON "BookingSeries"("businessId", "createdAt");

CREATE TABLE IF NOT EXISTS "SlotWaitlistEntry" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "serviceId" TEXT NOT NULL,
  "staffMemberId" TEXT,
  "date" DATE NOT NULL,
  "fromTime" TEXT NOT NULL,
  "toTime" TEXT NOT NULL,
  "partySize" INTEGER,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "phoneE164" TEXT NOT NULL,
  "customerEmail" TEXT,
  "status" "SlotWaitStatus" NOT NULL DEFAULT 'WAITING',
  "offeredTime" TEXT,
  "offerToken" TEXT,
  "offerExpiresAt" TIMESTAMP(3),
  "offers" INTEGER NOT NULL DEFAULT 0,
  "manageToken" TEXT NOT NULL,
  "bookingId" TEXT REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  -- A bounded number of offers per entry; an offer always has its token and deadline.
  CONSTRAINT "SlotWaitlistEntry_offers_chk" CHECK ("offers" BETWEEN 0 AND 3),
  CONSTRAINT "SlotWaitlistEntry_offer_chk" CHECK ("status" <> 'OFFERED' OR ("offerToken" IS NOT NULL AND "offerExpiresAt" IS NOT NULL AND "offeredTime" IS NOT NULL)),
  CONSTRAINT "SlotWaitlistEntry_window_chk" CHECK ("fromTime" < "toTime")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SlotWaitlistEntry_offerToken_key" ON "SlotWaitlistEntry"("offerToken");
CREATE UNIQUE INDEX IF NOT EXISTS "SlotWaitlistEntry_manageToken_key" ON "SlotWaitlistEntry"("manageToken");
CREATE UNIQUE INDEX IF NOT EXISTS "SlotWaitlistEntry_bookingId_key" ON "SlotWaitlistEntry"("bookingId");
CREATE INDEX IF NOT EXISTS "SlotWaitlistEntry_businessId_date_status_createdAt_idx" ON "SlotWaitlistEntry"("businessId", "date", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "SlotWaitlistEntry_status_offerExpiresAt_idx" ON "SlotWaitlistEntry"("status", "offerExpiresAt");
-- One live entry per number, business and day.
CREATE UNIQUE INDEX IF NOT EXISTS "SlotWaitlistEntry_live_key" ON "SlotWaitlistEntry"("businessId", "date", "phoneE164") WHERE "status" IN ('WAITING', 'OFFERED');

CREATE TABLE IF NOT EXISTS "LoyaltyProgram" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "organizationId" TEXT REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "pointsPerVisit" INTEGER NOT NULL DEFAULT 10,
  "pointsPer100Egp" INTEGER NOT NULL DEFAULT 0,
  "redeemPoints" INTEGER NOT NULL DEFAULT 100,
  "redeemValueCents" INTEGER NOT NULL DEFAULT 5000,
  "maxRedeemPercent" INTEGER NOT NULL DEFAULT 50,
  "expiryDays" INTEGER DEFAULT 365,
  "dailyEarnCap" INTEGER NOT NULL DEFAULT 2,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  -- Exactly one owner.
  CONSTRAINT "LoyaltyProgram_owner_chk" CHECK (("businessId" IS NULL) <> ("organizationId" IS NULL)),
  CONSTRAINT "LoyaltyProgram_rules_chk" CHECK (
    "pointsPerVisit" BETWEEN 0 AND 10000 AND "pointsPer100Egp" BETWEEN 0 AND 10000
    AND "redeemPoints" > 0 AND "redeemValueCents" > 0
    AND "maxRedeemPercent" BETWEEN 0 AND 100
    AND ("expiryDays" IS NULL OR "expiryDays" BETWEEN 30 AND 3650)
    AND "dailyEarnCap" BETWEEN 1 AND 10)
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyProgram_businessId_key" ON "LoyaltyProgram"("businessId");
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyProgram_organizationId_key" ON "LoyaltyProgram"("organizationId");

CREATE TABLE IF NOT EXISTS "LoyaltyParticipation" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "acceptedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyParticipation_programId_businessId_key" ON "LoyaltyParticipation"("programId", "businessId");
CREATE INDEX IF NOT EXISTS "LoyaltyParticipation_businessId_idx" ON "LoyaltyParticipation"("businessId");

CREATE TABLE IF NOT EXISTS "LoyaltyAccount" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "phoneE164" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyAccount_balance_chk" CHECK ("balance" >= 0 AND "lifetimeEarned" >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyAccount_programId_phoneE164_key" ON "LoyaltyAccount"("programId", "phoneE164");

CREATE TABLE IF NOT EXISTS "LoyaltyEntry" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL REFERENCES "LoyaltyProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "accountId" TEXT NOT NULL REFERENCES "LoyaltyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" "LoyaltyEntryKind" NOT NULL,
  "points" INTEGER NOT NULL,
  "remaining" INTEGER,
  "expiresAt" TIMESTAMP(3),
  "bookingId" TEXT,
  "businessId" TEXT,
  "sourceKey" TEXT NOT NULL,
  "note" TEXT,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Earning-type entries add, spending-type entries take; a lot never goes
  -- below zero or above what it was.
  CONSTRAINT "LoyaltyEntry_sign_chk" CHECK (
    ("kind" IN ('EARN', 'REDEEM_REVERSAL') AND "points" > 0)
    OR ("kind" IN ('EARN_REVERSAL', 'REDEEM', 'EXPIRE') AND "points" < 0)
    OR ("kind" = 'ADJUST' AND "points" <> 0)),
  CONSTRAINT "LoyaltyEntry_lot_chk" CHECK ("remaining" IS NULL OR ("remaining" >= 0 AND "remaining" <= "points"))
);
CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyEntry_sourceKey_key" ON "LoyaltyEntry"("sourceKey");
CREATE INDEX IF NOT EXISTS "LoyaltyEntry_accountId_createdAt_idx" ON "LoyaltyEntry"("accountId", "createdAt");
CREATE INDEX IF NOT EXISTS "LoyaltyEntry_expiresAt_idx" ON "LoyaltyEntry"("expiresAt");
CREATE INDEX IF NOT EXISTS "LoyaltyEntry_bookingId_idx" ON "LoyaltyEntry"("bookingId");

CREATE TABLE IF NOT EXISTS "PackagePlan" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT,
  "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sessions" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "validityDays" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PackagePlan_rules_chk" CHECK ("sessions" BETWEEN 1 AND 100 AND "priceCents" > 0 AND "validityDays" BETWEEN 7 AND 730)
);
CREATE INDEX IF NOT EXISTS "PackagePlan_businessId_isActive_idx" ON "PackagePlan"("businessId", "isActive");

CREATE TABLE IF NOT EXISTS "CustomerPackage" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL REFERENCES "PackagePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "phoneE164" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sessionsTotal" INTEGER NOT NULL,
  "sessionsUsed" INTEGER NOT NULL DEFAULT 0,
  "priceCents" INTEGER NOT NULL,
  "status" "PackageStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "activatedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  -- Never more sessions used than bought, never fewer than none.
  CONSTRAINT "CustomerPackage_sessions_chk" CHECK ("sessionsUsed" >= 0 AND "sessionsUsed" <= "sessionsTotal" AND "sessionsTotal" > 0)
);
CREATE INDEX IF NOT EXISTS "CustomerPackage_businessId_phoneE164_status_idx" ON "CustomerPackage"("businessId", "phoneE164", "status");
CREATE INDEX IF NOT EXISTS "CustomerPackage_status_expiresAt_idx" ON "CustomerPackage"("status", "expiresAt");

CREATE TABLE IF NOT EXISTS "MembershipPlan" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT,
  "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "priceCents" INTEGER NOT NULL,
  "periodDays" INTEGER NOT NULL DEFAULT 30,
  "includedVisits" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MembershipPlan_rules_chk" CHECK ("priceCents" > 0 AND "periodDays" BETWEEN 7 AND 366 AND "includedVisits" BETWEEN 1 AND 100)
);
CREATE INDEX IF NOT EXISTS "MembershipPlan_businessId_isActive_idx" ON "MembershipPlan"("businessId", "isActive");

CREATE TABLE IF NOT EXISTS "CustomerMembership" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL REFERENCES "MembershipPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "phoneE164" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "serviceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "includedVisits" INTEGER NOT NULL,
  "periodDays" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "status" "CustomerMembershipStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "paidThrough" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "pausedDays" INTEGER NOT NULL DEFAULT 0,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerMembership_rules_chk" CHECK ("includedVisits" > 0 AND "periodDays" > 0 AND "priceCents" > 0),
  CONSTRAINT "CustomerMembership_pause_chk" CHECK ("pausedDays" BETWEEN 0 AND 60),
  CONSTRAINT "CustomerMembership_paid_chk" CHECK ("status" = 'PENDING_PAYMENT' OR "paidThrough" IS NOT NULL),
  CONSTRAINT "CustomerMembership_paused_chk" CHECK (("status" = 'PAUSED') = ("pausedAt" IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS "CustomerMembership_businessId_phoneE164_status_idx" ON "CustomerMembership"("businessId", "phoneE164", "status");
CREATE INDEX IF NOT EXISTS "CustomerMembership_status_paidThrough_idx" ON "CustomerMembership"("status", "paidThrough");

CREATE TABLE IF NOT EXISTS "MembershipPeriod" (
  "id" TEXT PRIMARY KEY,
  "membershipId" TEXT NOT NULL REFERENCES "CustomerMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "includedVisits" INTEGER NOT NULL,
  "used" INTEGER NOT NULL DEFAULT 0,
  "paymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Never more visits taken than the period includes.
  CONSTRAINT "MembershipPeriod_use_chk" CHECK ("used" >= 0 AND "used" <= "includedVisits" AND "includedVisits" > 0 AND "endsAt" > "startsAt")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MembershipPeriod_paymentId_key" ON "MembershipPeriod"("paymentId");
CREATE INDEX IF NOT EXISTS "MembershipPeriod_membershipId_endsAt_idx" ON "MembershipPeriod"("membershipId", "endsAt");

CREATE TABLE IF NOT EXISTS "EntitlementUse" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT NOT NULL REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "packageId" TEXT REFERENCES "CustomerPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "membershipId" TEXT REFERENCES "CustomerMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "periodId" TEXT REFERENCES "MembershipPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reversedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Exactly one source.
  CONSTRAINT "EntitlementUse_source_chk" CHECK (("packageId" IS NULL) <> ("membershipId" IS NULL)),
  CONSTRAINT "EntitlementUse_period_chk" CHECK (("membershipId" IS NULL) = ("periodId" IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS "EntitlementUse_bookingId_key" ON "EntitlementUse"("bookingId");
CREATE INDEX IF NOT EXISTS "EntitlementUse_packageId_idx" ON "EntitlementUse"("packageId");
CREATE INDEX IF NOT EXISTS "EntitlementUse_membershipId_idx" ON "EntitlementUse"("membershipId");

CREATE TABLE IF NOT EXISTS "OrganizationPromotion" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "VenueOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT,
  "kind" "DiscountKind" NOT NULL,
  "value" INTEGER NOT NULL,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationPromotion_value_chk" CHECK (("kind" = 'PERCENT' AND "value" BETWEEN 1 AND 100) OR ("kind" = 'FIXED' AND "value" > 0))
);
CREATE INDEX IF NOT EXISTS "OrganizationPromotion_organizationId_idx" ON "OrganizationPromotion"("organizationId");

-- ─── Booking: series link and limits ───────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "Booking_seriesId_seriesIndex_key" ON "Booking"("seriesId", "seriesIndex");
DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookingSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_phase27_chk" CHECK ("loyaltyCents" >= 0 AND "companions" BETWEEN 0 AND 10);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Business" ADD CONSTRAINT "Business_phase27_chk" CHECK (
    ("noShowLimit" IS NULL OR "noShowLimit" BETWEEN 1 AND 20)
    AND "noShowWindowDays" BETWEEN 30 AND 730
    AND "waitlistOfferMinutes" BETWEEN 10 AND 240
    AND "maxCompanions" BETWEEN 0 AND 5
    AND "followUpDelayHours" BETWEEN 1 AND 168
    AND "rebookAfterDays" BETWEEN 7 AND 365
    AND "membershipRenewalNoticeDays" BETWEEN 1 AND 14);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_commission_chk" CHECK ("commissionPercent" IS NULL OR "commissionPercent" BETWEEN 0 AND 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Payment: what a non-booking payment pays for ───────────────────────────
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_target_chk";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_target_chk" CHECK (
  ("kind" = 'SUBSCRIPTION' AND "plan" IS NOT NULL AND "bookingId" IS NULL AND "customerPackageId" IS NULL AND "customerMembershipId" IS NULL)
  OR ("kind" = 'PACKAGE' AND "customerPackageId" IS NOT NULL AND "bookingId" IS NULL AND "customerMembershipId" IS NULL)
  OR ("kind" = 'MEMBERSHIP' AND "customerMembershipId" IS NOT NULL AND "bookingId" IS NULL AND "customerPackageId" IS NULL)
  OR ("kind" IN ('BOOKING_DEPOSIT', 'BOOKING_BALANCE', 'BOOKING_FULL') AND "bookingId" IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS "Payment_customerPackageId_idx" ON "Payment"("customerPackageId");
CREATE INDEX IF NOT EXISTS "Payment_customerMembershipId_idx" ON "Payment"("customerMembershipId");
