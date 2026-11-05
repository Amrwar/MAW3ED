import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { loadVenueCaller } from "@/lib/venues/guard";
import { orgAuthorityOver, orgCan } from "@/lib/organizations/access";
import OrgIntegrationsClient from "./_components/OrgIntegrationsClient";

export const metadata: Metadata = { title: "الربط والتكامل", robots: { index: false, follow: false } };

/**
 * An organization's integrations: its agreement with the platform, API
 * keys, webhooks and the health of everything connected. The page checks
 * viewing; keys and webhooks are the owner's (org.integrations), and each
 * of their API routes checks that again.
 */
export default async function OrgIntegrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await loadVenueCaller();
  if (!caller) redirect(`/login?next=/org-admin/${id}/integrations`);
  const org = await db.organization.findUnique({ where: { id }, select: { id: true, nameAr: true, nameEn: true } });
  const authority = org ? orgAuthorityOver(caller, id) : null;
  if (!org || !orgCan(authority, "org.view")) notFound();
  return (
    <OrgIntegrationsClient
      organizationId={id}
      name={{ ar: org.nameAr, en: org.nameEn }}
      canManage={orgCan(authority, "org.integrations")}
    />
  );
}
