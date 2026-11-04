import type { Metadata } from "next";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getRevenueReport, lastDays, reportDays } from "@/lib/dashboard/reports";
import ReportShell from "../_components/ReportShell";
import RevenueView from "./RevenueView";

export const metadata: Metadata = { title: "تقرير الإيرادات" };

export default async function RevenueReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business } = await requireDashboardAccess("finance.read");
  const sp = await searchParams;
  const days = reportDays(sp.days);

  const report = await getRevenueReport(business.id, lastDays(days));

  return (
    <ReportShell>
      <RevenueView
        total={report.total}
        completedCount={report.completedCount}
        average={report.average}
        byDay={report.byDay}
        byService={report.byService}
        days={days}
      />
    </ReportShell>
  );
}
