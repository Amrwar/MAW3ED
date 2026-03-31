import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import BookingsClient from "./_components/BookingsClient";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";

export const metadata: Metadata = { title: "\u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a | \u0645\u0648\u0639\u062f" };

export default async function BookingsPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/onboarding");

  const businessId = session.user.businessId;

  // Today's UTC midnight for date-exact query
  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [rawToday, services, totalBookings] = await Promise.all([
    // Today's bookings (all statuses except cancelled, ordered by startTime)
    db.booking.findMany({
      where: {
        businessId,
        date:   todayUTC,
        status: { not: "CANCELLED" },
      },
      include: { service: { select: { nameAr: true, duration: true } } },
      orderBy: { startTime: "asc" },
    }),
    // Services for filter dropdown
    db.service.findMany({
      where:   { businessId },
      select:  { id: true, nameAr: true },
      orderBy: { sortOrder: "asc" },
    }),
    // Total booking count
    db.booking.count({ where: { businessId } }),
  ]);

  // Serialize to plain objects (no Date / Decimal)
  const initialTodayBookings: DashboardBooking[] = rawToday.map((b) => ({
    id:              b.id,
    customerName:    b.customerName,
    customerPhone:   b.customerPhone,
    serviceName:     b.service.nameAr,
    serviceDuration: b.service.duration,
    date:            b.date.toISOString().split("T")[0],
    startTime:       b.startTime,
    endTime:         b.endTime,
    status:          b.status as DashboardBooking["status"],
    totalPrice:      Number(b.totalPrice),
    currency:        b.currency,
    notes:           b.notes,
    customerNotes:   null,
    createdAt:       b.createdAt.toISOString(),
  }));

  return (
    <BookingsClient
      initialTodayBookings={initialTodayBookings}
      services={services}
      totalBookings={totalBookings}
    />
  );
}
