import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import LoyaltyClient from "./_components/LoyaltyClient";

export const metadata: Metadata = { title: "النقاط والولاء" };

/**
 * The business's loyalty program: its rules, what is outstanding, one
 * customer's points with the owner's correction, and the invitations of
 * organizations it belongs to. Owner only — points are money.
 */
export default async function LoyaltyPage() {
  await requireBusinessPage();
  return <LoyaltyClient />;
}
