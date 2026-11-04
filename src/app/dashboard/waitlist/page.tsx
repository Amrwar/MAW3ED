import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import WaitlistClient from "./_components/WaitlistClient";

export const metadata: Metadata = { title: "قائمة الانتظار" };

/**
 * Who waits for a time on a day, in the order they will be offered one.
 * Read-only: offers go out by themselves when a time frees up. The
 * owner, or a delegate who may see every booking.
 */
export default async function WaitlistPage() {
  const { business } = await requireDashboardAccess("bookings.readAll");
  const [services, staff, settings] = await Promise.all([
    db.service.findMany({ where: { businessId: business.id }, select: { id: true, nameAr: true, nameEn: true } }),
    db.staffMember.findMany({ where: { businessId: business.id }, select: { id: true, nameAr: true, nameEn: true } }),
    db.business.findUnique({ where: { id: business.id }, select: { waitlistEnabled: true, waitlistOfferMinutes: true } }),
  ]);
  return (
    <WaitlistClient
      services={services}
      staff={staff}
      enabled={settings?.waitlistEnabled ?? false}
      offerMinutes={settings?.waitlistOfferMinutes ?? 30}
    />
  );
}
