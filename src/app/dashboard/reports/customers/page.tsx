import type { Metadata } from "next";
import { requireBusinessPage } from "@/lib/dashboard/guard";
import { getCustomersReport, lastDays } from "@/lib/dashboard/reports";
import ReportShell from "../_components/ReportShell";
import CustomersView from "./CustomersView";

export const metadata: Metadata = { title: "تقرير العملاء" };

export default async function CustomersReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business } = await requireBusinessPage();
  const sp = await searchParams;
  const days = Number(Array.isArray(sp.days) ? sp.days[0] : (sp.days ?? 30)) || 30;

  const r = await getCustomersReport(business.id, lastDays(days));

  return (
    <ReportShell>
      <CustomersView
        totalCustomers={r.totalCustomers}
        newInPeriod={r.newInPeriod}
        returningInPeriod={r.returningInPeriod}
        repeatCustomers={r.repeatCustomers}
        averageVisits={r.averageVisits}
        top={r.top}
        days={days}
      />
    </ReportShell>
  );
}
