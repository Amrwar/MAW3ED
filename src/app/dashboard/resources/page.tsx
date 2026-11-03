import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import ResourcesClient, { type ResourceRow } from "./_components/ResourcesClient";

export const metadata: Metadata = { title: "الموارد" };

export default async function ResourcesPage() {
  // The owner, or an organization the owner granted RESOURCES.
  const ctx = await requireDashboardAccess("resources.manage");

  const [resources, branches] = await Promise.all([
    db.resource.findMany({
      where: { businessId: ctx.business.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        branch: { select: { id: true, nameAr: true } },
        _count: { select: { bookings: true } },
      },
    }),
    db.branch.findMany({
      where: { businessId: ctx.business.id, isActive: true },
      select: { id: true, nameAr: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return <ResourcesClient initial={resources as ResourceRow[]} branches={branches} />;
}
