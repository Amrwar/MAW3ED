import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import DashboardHomeClient from "@/features/dashboard/DashboardHomeClient";
import { getDashboardKpis } from "@/lib/dashboard/queries";
import { cairoDayEnd, cairoDayStart } from "@/lib/bookings/instants";
import { type RecentBooking } from "@/features/dashboard/RecentBookings";
import { type DashboardBooking } from "@/features/dashboard/bookings/types";

export const metadata: Metadata = { title: "لوحة التحكم" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/onboarding");

  const business = await db.business.findUnique({
    where:   { id: session.user.businessId },
    include: {
      services:     { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } },
      availability: { orderBy: { dayOfWeek: "asc" } },
      category:     true,
      city:         true,
      _count:       { select: { bookings: true, customers: true } },
    },
  });

  if (!business) redirect("/onboarding");

  const businessId       = session.user.businessId;

  // The headline numbers come from getDashboardKpis; this is only what
  // the lists below need. Seven aggregate queries that fed the old
  // stats cards used to run here on every load and are gone with them.
  const [rawBookings, rawTodayBookings] = await Promise.all([
    db.booking.findMany({
      where:   { businessId },
      include: { service: { select: { nameAr: true } } },
      orderBy: { date: "desc" },
      take:    20,
    }),
    db.booking.findMany({
      where: {
        businessId,
        startsAt: { gte: cairoDayStart(), lt: cairoDayEnd() },
        status: { in: ["PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"] },
      },
      include: { service: { select: { nameAr: true, duration: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  // Counted from booking rows, in the one place that defines what
  // "completed", "revenue" and "no-show" mean. See lib/dashboard/stats.
  const kpis = await getDashboardKpis(businessId);

  const recentBookings: RecentBooking[] = rawBookings.map((b) => ({
    id:            b.id,
    customerName:  b.customerName,
    customerPhone: b.customerPhone,
    serviceName:   b.service.nameAr,
    date:          b.date,
    startTime:     b.startTime,
    status:        b.status as RecentBooking["status"],
    totalPrice:    Number(b.totalPrice),
    currency:      b.currency,
  }));

  const todayBookings: DashboardBooking[] = rawTodayBookings.map((b) => ({
    id:              b.id,
    customerName:    b.customerName,
    customerPhone:   b.customerPhone,
    serviceName:     b.service.nameAr,
    serviceDuration: b.service.duration,
    date:            b.date.toISOString().slice(0, 10),
    startTime:       b.startTime,
    endTime:         b.endTime ?? null,
    status:          b.status as DashboardBooking["status"],
    totalPrice:      Number(b.totalPrice),
    depositAmount:   b.depositAmount !== null && b.depositAmount !== undefined ? Number(b.depositAmount) : null,
    currency:        b.currency,
    notes:           b.notes ?? null,
    customerNotes:   null,
    createdAt:       b.createdAt.toISOString(),
    tableName:       null,
    staffName:       null,
    partySize:       null,
  }));

  const widgetServices = business.services.map((s) => ({
    id:       s.id,
    nameAr:   s.nameAr,
    duration: s.duration,
    price:    Number(s.price),
    currency: s.currency,
  }));

  const todayDayOfWeek = new Date().getDay();
  const todayHours = business.availability.find((a) => a.dayOfWeek === todayDayOfWeek);
  const isOpenToday = todayHours && !todayHours.isClosed;
  const openDaysCount = business.availability.filter((a) => !a.isClosed).length;
  const isProfileIncomplete = !business.about || !business.address;

  return (
    <DashboardHomeClient
      businessNameAr={business.nameAr}
      slug={business.slug}
      services={widgetServices}
      kpis={kpis}
      recentBookings={recentBookings}
      todayBookings={todayBookings}
      openDaysCount={openDaysCount}
      isOpenToday={!!isOpenToday}
      todayHours={todayHours ? { openTime: todayHours.openTime, closeTime: todayHours.closeTime, isClosed: todayHours.isClosed } : null}
      isProfileIncomplete={isProfileIncomplete}
    />
  );
}
