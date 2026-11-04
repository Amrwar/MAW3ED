import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import PackagesClient from "./_components/PackagesClient";

export const metadata: Metadata = { title: "الباقات والعضويات" };

/**
 * Packages (sessions sold ahead) and memberships (a fee per period with
 * included visits): the plans, selling one at the desk, and what the
 * desk does to one already sold. Owner only — it is money.
 */
export default async function PackagesPage() {
  const { business } = await requireBusinessPage();
  const services = await db.service.findMany({
    where: { businessId: business.id, isAvailable: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, nameAr: true, nameEn: true },
  });
  return <PackagesClient services={services} />;
}
