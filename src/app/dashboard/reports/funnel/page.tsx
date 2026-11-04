import type { Metadata } from "next";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { reportDays } from "@/lib/dashboard/reports";
import { getFunnelReport } from "@/lib/analytics/funnel-report";
import ReportShell from "../_components/ReportShell";
import FunnelReportView from "@/components/analytics/FunnelReportView";

export const metadata: Metadata = { title: "رحلة الحجز" };

/**
 * The business's own booking funnel: its page, service picked, booking
 * started, time picked (reported by browsers, per tab and day), then the
 * bookings, payments, cancellations and repeat bookings its records hold.
 * Reports access, like the other reports; payment outcomes are counts.
 */
export default async function FunnelReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { business } = await requireDashboardAccess("reports.read");
  const days = reportDays((await searchParams).days);
  const data = await getFunnelReport({ kind: "business", businessId: business.id }, days);
  return (
    <ReportShell>
      <FunnelReportView data={data} steps={["BUSINESS_VIEW", "SERVICE_SELECTED", "BOOKING_STARTED", "TIME_SELECTED"]} />
    </ReportShell>
  );
}
