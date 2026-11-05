import { requireAdminPage } from "@/lib/admin/guard";
import { adminMetadata } from "@/lib/admin/meta";
import { can } from "@/lib/admin/permissions";
import OperationsClient from "./_components/OperationsClient";

export const generateMetadata = adminMetadata("reports.read", "التشغيل");

/**
 * The platform's operations dashboard: health, scheduled jobs, queue
 * depths, recent runs and feature flags (reports.read), and the payment
 * reconciliation for those who may read payments. Everything is read
 * from /api/admin/operations and /api/admin/payments/reconciliation,
 * which check their own permissions again.
 */
export default async function AdminOperationsPage() {
  const admin = await requireAdminPage("reports.read");
  return <OperationsClient canReconcile={can(admin.role, "payments.read")} />;
}
