import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loadVenueCaller } from "@/lib/venues/guard";
import { orgAuthorityOver, orgCan } from "@/lib/organizations/access";
import OrgConsole from "./_components/OrgConsole";

export const metadata: Metadata = { title: "إدارة الجهة", robots: { index: false, follow: false } };

/**
 * One organization's console. The page only checks viewing; every
 * action inside goes through its own API route, which checks again.
 */
export default async function OrgConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await loadVenueCaller();
  if (!caller) redirect(`/login?next=/org-admin/${id}`);
  const org = await db.organization.findUnique({ where: { id }, select: { id: true } });
  if (!org || !orgCan(orgAuthorityOver(caller, id), "org.view")) notFound();
  return <OrgConsole organizationId={id} />;
}
