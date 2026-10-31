import type { Metadata } from "next";
import { requireDashboardAccess } from "@/lib/dashboard/guard";
import { getUpcomingBookings } from "@/lib/dashboard/queries";
import BookingList from "../../_components/BookingList";
import { shapeBooking } from "../../_components/shape";

export const metadata: Metadata = { title: "المواعيد الجاية" };

/** Everything still ahead, nearest first. */
export default async function UpcomingPage() {
  const { business, actor } = await requireDashboardAccess("bookings.read");
  const { rows, total } = await getUpcomingBookings(business.id, { take: 100, branchIds: actor.delegation?.branchIds ?? null });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="m-0 text-[1.375rem] font-light tracking-tight text-[var(--color-ink)]">
          المواعيد الجاية
        </h1>
        {total > rows.length && (
          <p className="num m-0 mt-1 text-[0.8125rem] text-[var(--color-subtle)]">
            أقرب {rows.length} من {total}
          </p>
        )}
      </header>
      <BookingList bookings={rows.map(shapeBooking)} variant="upcoming" />
    </div>
  );
}
