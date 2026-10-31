import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { can } from "@/lib/business-access";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getCustomersReport, lastDays } from "@/lib/dashboard/reports";
import ReportShell from "../_components/ReportShell";
import CustomersView from "./CustomersView";

export const metadata: Metadata = { title: "تقرير العملاء" };

export default async function CustomersReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // This report names customers: REPORTS alone is not enough, it also
  // takes CUSTOMERS; and what they spent takes FINANCE.
  const { business, actor } = await requireDashboardAccess("reports.read");
  if (!can(actor, "customers.read")) redirect("/dashboard/reports/bookings");
  const showMoney = can(actor, "finance.read");
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
        // Stripped here, not hidden in the browser: what is not sent cannot leak.
        top={showMoney ? r.top : r.top.map((c) => ({ ...c, spend: 0 }))}
        showMoney={showMoney}
        days={days}
      />
    </ReportShell>
  );
}
