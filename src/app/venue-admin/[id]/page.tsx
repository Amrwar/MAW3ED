import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadVenueCaller } from "@/lib/venues/guard";
import { db } from "@/lib/db";
import { authorityOver, venueCan } from "@/lib/venues/access";
import VenueConsole from "./_components/VenueConsole";

export const metadata: Metadata = { title: "إدارة المكان", robots: { index: false, follow: false } };

/**
 * One venue's console. The page only checks that the caller may view
 * this venue; every action inside goes through its own API route, which
 * checks again (lib/venues/guard.ts).
 */
export default async function VenueConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await loadVenueCaller();
  if (!caller) redirect(`/login?next=/venue-admin/${id}`);
  const venue = await db.venue.findUnique({ where: { id }, select: { id: true, organizationId: true, compoundId: true } });
  if (!venue || !venueCan(authorityOver(caller, venue), "venue.view")) notFound();
  return <VenueConsole venueId={id} />;
}
