import type { Metadata } from "next";
import { can } from "@/lib/business-access";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getPerformanceReport, lastDays } from "@/lib/dashboard/reports";
import ReportShell from "../_components/ReportShell";
import PerformanceView from "./PerformanceView";

export const metadata: Metadata = { title: "تقرير الأداء" };

export default async function PerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business, actor } = await requireDashboardAccess("reports.read");
  // Revenue per staff member is money: FINANCE only, stripped server-side.
  const showMoney = can(actor, "finance.read");
  const sp = await searchParams;
  const days = Number(Array.isArray(sp.days) ? sp.days[0] : (sp.days ?? 30)) || 30;

  const r = await getPerformanceReport(business.id, lastDays(days));

  return (
    <ReportShell sampleSize={r.sampleSize}>
      <PerformanceView
        completionRate={r.completionRate}
        cancellationRate={r.cancellationRate}
        noShowRate={r.noShowRate}
        sampleSize={r.sampleSize}
        byStaff={showMoney ? r.byStaff : r.byStaff.map((s) => ({ ...s, revenue: 0 }))}
        showMoney={showMoney}
        byService={r.byService}
      />
    </ReportShell>
  );
}
