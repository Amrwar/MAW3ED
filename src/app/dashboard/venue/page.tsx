import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import VenueMembershipClient from "./_components/VenueMembershipClient";

export const metadata: Metadata = { title: "المول أو المجمع" };

/** Owner only, like the API behind it. Being in a venue is optional. */
export default async function DashboardVenuePage() {
  await requireBusinessPage();
  return <VenueMembershipClient />;
}
