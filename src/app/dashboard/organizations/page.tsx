import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import OrgMembershipClient from "./_components/OrgMembershipClient";

export const metadata: Metadata = { title: "الجهات والمجموعات" };

/** Owner only, like the API behind it. Belonging is optional. */
export default async function DashboardOrganizationsPage() {
  await requireBusinessPage();
  return <OrgMembershipClient />;
}
