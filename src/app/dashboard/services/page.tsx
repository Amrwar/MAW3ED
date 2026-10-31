import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import ServicesClient from "./_components/ServicesClient";

export const metadata: Metadata = { title: "الخدمات" };

export default async function ServicesPage() {
  // An editor: the owner, or a delegate granted SERVICES.
  const { business } = await requireDashboardAccess("services.manage");

  const services = await db.service.findMany({
    where:   { businessId: business.id },
    orderBy: { sortOrder: "asc" },
  });

  const serialized = services.map((s) => ({
    id:            s.id,
    nameAr:        s.nameAr,
    nameEn:        s.nameEn ?? "",
    descriptionAr: s.descriptionAr ?? "",
    duration:      s.duration,
    price:         Number(s.price),
    currency:      s.currency,
    isAvailable:   s.isAvailable,
    sortOrder:     s.sortOrder,
  }));

  return <ServicesClient initialServices={serialized} />;
}
