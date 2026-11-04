import type { Metadata } from "next";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getBookingsReport, lastDays, reportDays } from "@/lib/dashboard/reports";
import ReportShell from "../_components/ReportShell";
import BookingsView from "./BookingsView";

export const metadata: Metadata = { title: "تقرير الحجوزات" };

export default async function BookingsReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business } = await requireDashboardAccess("reports.read");
  const sp = await searchParams;
  const days = reportDays(sp.days);

  const r = await getBookingsReport(business.id, lastDays(days));

  return (
    <ReportShell>
      <BookingsView
        total={r.total}
        completed={r.completed}
        cancelled={r.cancelled}
        noShows={r.noShows}
        byDay={r.byDay}
        byService={r.byService}
        byHour={r.byHour}
        days={days}
      />
    </ReportShell>
  );
}
