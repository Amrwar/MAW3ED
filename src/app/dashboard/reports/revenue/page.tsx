import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import { getRevenueReport, lastDays } from "@/lib/dashboard/reports";
import ReportShell from "../_components/ReportShell";
import RevenueView from "./RevenueView";

export const metadata: Metadata = { title: "تقرير الإيرادات" };

export default async function RevenueReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business } = await requireBusinessPage();
  const sp = await searchParams;
  const days = Number(Array.isArray(sp.days) ? sp.days[0] : (sp.days ?? 30)) || 30;

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
