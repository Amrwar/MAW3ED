import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import BookingsClient from "./_components/BookingsClient";
import type { DashboardBooking } from "@/features/dashboard/bookings/types";

export const metadata: Metadata = { title: "الحجوزات" };

export default async function BookingsPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/onboarding");

  const businessId = session.user.businessId;

  // Today's UTC midnight for date-exact query
  const now = new Date();
  const todayUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [rawToday, services, totalBookings, business] = await Promise.all([
    // Today's bookings (all statuses except cancelled, ordered by startTime)
    db.booking.findMany({
      where: {
        businessId,
        date:   todayUTC,
        status: { not: "CANCELLED" },
      },
      include: {
        service:     { select: { nameAr: true, duration: true } },
        table:       { select: { name: true } },
        staffMember: { select: { nameAr: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    // Services for filter dropdown + manual booking
    db.service.findMany({
      where:   { businessId, isAvailable: true },
      select:  { id: true, nameAr: true, duration: true, price: true, currency: true },
      orderBy: { sortOrder: "asc" },
    }),
    // Total booking count
    db.booking.count({ where: { businessId } }),
    // Slug for slot generation
    db.business.findUnique({
      where:  { id: businessId },
      select: { slug: true },
    }),
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
    depositAmount:   b.depositAmount !== null ? Number(b.depositAmount) : null,
    currency:        b.currency,
    notes:           b.notes,
    customerNotes:   null,
    createdAt:       b.createdAt.toISOString(),
    tableName:       b.table?.name        ?? null,
    staffName:       b.staffMember?.nameAr ?? null,
    partySize:       b.partySize           ?? null,
  }));

  const serviceOptions = services.map((s) => ({
    id:       s.id,
    nameAr:   s.nameAr,
    duration: s.duration,
    price:    Number(s.price),
    currency: s.currency,
  }));

  return (
    <BookingsClient
      initialTodayBookings={initialTodayBookings}
      services={services}
      serviceOptions={serviceOptions}
      slug={business?.slug ?? ""}
      totalBookings={totalBookings}
    />
  );
}
