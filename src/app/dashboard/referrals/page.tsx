import { requireBusinessPage } from "@/lib/dashboard/guard";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import crypto from "crypto";
import ReferralsClient from "./_components/ReferralsClient";
import { siteUrl } from "@/lib/env";

export const metadata: Metadata = { title: "الإحالات" };

/** Generates a unique 8-char uppercase hex referral code. */
async function generateReferralCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = crypto.randomBytes(4).toString("hex").toUpperCase();
    const exists = await db.business.findUnique({
      where:  { referralCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return crypto.randomBytes(8).toString("hex").toUpperCase();
}

export default async function ReferralsPage() {
  // Not from the token alone: one naming a deleted or re-created business
  // sent this page to /onboarding while onboarding, which looks by owner,
  // sent it back (lib/dashboard/onboarding-loop.test.ts).
  const { business: owned } = await requireBusinessPage();

  const business = await db.business.findUnique({
    where:  { id: owned.id },
    select: {
      id:           true,
      referralCode: true,
      referrals: {
        select: {
          id:                 true,
          nameAr:             true,
          createdAt:          true,
          referralRewardedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!business) redirect("/onboarding");

  // Lazy-generate referral code for businesses created before this feature
  let referralCode = business.referralCode;
  if (!referralCode) {
    referralCode = await generateReferralCode();
    await db.business.update({
      where: { id: business.id },
      data:  { referralCode },
    });
  }

  const baseUrl = siteUrl;
  const referralLink = `${baseUrl}/ref/${referralCode}`;

  const referrals = business.referrals.map((r) => ({
    id:       r.id,
    nameAr:   r.nameAr,
    joinedAt: r.createdAt.toISOString(),
    rewarded: r.referralRewardedAt !== null,
  }));

  return (
    <ReferralsClient
      referralCode={referralCode}
      referralLink={referralLink}
      referrals={referrals}
    />
  );
}
