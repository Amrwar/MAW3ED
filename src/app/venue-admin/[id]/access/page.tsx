import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadVenueCaller } from "@/lib/venues/guard";
import { db } from "@/lib/db";
import { authorityOver, venueCan } from "@/lib/venues/access";
import AccessDesk from "./_components/AccessDesk";

export const metadata: Metadata = { title: "دخول الزوار", robots: { index: false, follow: false } };

/**
 * The venue's visitor-access desk: today's passes, gate events, what
 * needs a person, and (for operators) the access settings. The page
 * checks only that the caller may view access; every action goes through
 * /api/venues/:id/access/*, which checks again.
 */
export default async function VenueAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await loadVenueCaller();
  if (!caller) redirect(`/login?next=/venue-admin/${id}/access`);
  const venue = await db.venue.findUnique({ where: { id }, select: { id: true, organizationId: true, compoundId: true, nameAr: true } });
  if (!venue || !venueCan(authorityOver(caller, venue), "venue.access.view")) notFound();
  return <AccessDesk venueId={id} venueName={venue.nameAr} />;
}
