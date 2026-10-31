import { redirect } from "next/navigation";
import { can } from "@/lib/business-access";
import { requireDashboardAccess } from "@/lib/dashboard/guard";

/**
 * The reports group opens on revenue — for whoever may see money (the
 * owner, a delegate granted FINANCE); on bookings for everybody else.
 */
export default async function ReportsPage() {
  const { actor } = await requireDashboardAccess("reports.read");
  redirect(can(actor, "finance.read") ? "/dashboard/reports/revenue" : "/dashboard/reports/bookings");
}
