import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import TablesClient from "./_components/TablesClient";

export const metadata: Metadata = { title: "الطاولات | موعد" };

export default async function TablesPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/dashboard");

  const tables = await db.table.findMany({
    where:   { businessId: session.user.businessId },
    orderBy: { createdAt: "asc" },
  });

  const serialized = tables.map((t) => ({
    id:        t.id,
    name:      t.name,
    tableType: t.tableType,
    capacity:  t.capacity,
    notes:     t.notes ?? "",
    isActive:  t.isActive,
  }));

  return <TablesClient initialTables={serialized} />;
}
