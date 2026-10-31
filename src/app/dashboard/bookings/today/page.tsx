import type { Metadata } from "next";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getTodayBookings } from "@/lib/dashboard/queries";
import BookingList from "../../_components/BookingList";
import { shapeBooking } from "../../_components/shape";

export const metadata: Metadata = { title: "مواعيد النهارده" };

/** Today, by the Cairo day the business is actually working. */
export default async function TodayPage() {
  const { business, actor } = await requireDashboardAccess("bookings.read");
  const rows = await getTodayBookings(business.id, new Date(), actor.delegation?.branchIds ?? null);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">
          مواعيد النهارده
        </h1>
      </header>
      <BookingList bookings={rows.map(shapeBooking)} variant="today" />
    </div>
  );
}
