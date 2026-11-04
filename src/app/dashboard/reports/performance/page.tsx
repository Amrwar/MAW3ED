import type { Metadata } from "next";
import { can } from "@/lib/business-access";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getPerformanceReport, lastDays, reportDays } from "@/lib/dashboard/reports";
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
  const days = reportDays(sp.days);

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
