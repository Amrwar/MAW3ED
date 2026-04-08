import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import crypto from "crypto";
import ReferralsClient from "./_components/ReferralsClient";

export const metadata: Metadata = { title: "الإحالات | موعد" };

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
  const session = await auth();
  if (!session?.user?.businessId) redirect("/onboarding");

  const business = await db.business.findUnique({
    where:  { id: session.user.businessId },
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

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://www.maw3ed.net";
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
