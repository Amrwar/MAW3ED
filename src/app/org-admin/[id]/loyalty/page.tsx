import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loadVenueCaller } from "@/lib/venues/guard";
import { orgAuthorityOver, orgCan } from "@/lib/organizations/access";
import OrgLoyaltyClient from "./_components/OrgLoyaltyClient";

export const metadata: Metadata = { title: "النقاط والعروض", robots: { index: false, follow: false } };

/**
 * An organization's loyalty program, promotions and packages report,
 * across the brands it owns. The page checks viewing; each change goes
 * through its own API route, which checks editing again.
 */
export default async function OrgLoyaltyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await loadVenueCaller();
  if (!caller) redirect(`/login?next=/org-admin/${id}/loyalty`);
  const org = await db.organization.findUnique({ where: { id }, select: { id: true, nameAr: true, nameEn: true } });
  const authority = org ? orgAuthorityOver(caller, id) : null;
  if (!org || !orgCan(authority, "org.view")) notFound();
  return (
    <OrgLoyaltyClient
      organizationId={id}
      name={{ ar: org.nameAr, en: org.nameEn }}
      canEdit={orgCan(authority, "org.edit")}
    />
  );
}
