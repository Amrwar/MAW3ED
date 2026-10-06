import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import { getPerformanceReport, lastDays } from "@/lib/dashboard/reports";
import ReportShell from "../_components/ReportShell";
import PerformanceView from "./PerformanceView";

export const metadata: Metadata = { title: "تقرير الأداء" };

export default async function PerformanceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business } = await requireBusinessPage();
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
        byStaff={r.byStaff}
        byService={r.byService}
      />
    </ReportShell>
  );
}
