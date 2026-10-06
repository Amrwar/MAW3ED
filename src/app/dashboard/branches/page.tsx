import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBusiness } from "@/lib/api";
import BranchesClient, { type BranchRow } from "./_components/BranchesClient";

export const metadata: Metadata = { title: "الفروع" };

export default async function BranchesPage() {
  const ctx = await requireBusiness().catch(() => null);
  if (!ctx) redirect("/login");

  const branches = await db.branch.findMany({
    where: { businessId: ctx.business.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { bookings: true, resources: true } } },
  });

  return <BranchesClient initial={branches as BranchRow[]} />;
}
