import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import DashboardHomeClient from "@/features/dashboard/DashboardHomeClient";
import { type DashboardStats } from "@/features/dashboard/StatsCards";
import { type RecentBooking } from "@/features/dashboard/RecentBookings";
import { type DashboardBooking } from "@/features/dashboard/bookings/types";

export const metadata: Metadata = { title: "لوحة التحكم | موعد" };

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

  const now              = new Date();
  const startThisMonth   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startLastMonth   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const todayStart       = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayEnd         = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const businessId       = session.user.businessId;

  const [
    rawBookings,
    bookingsThisMonth,
    bookingsLastMonth,
    totalCustomers,
    newCustomers,
    pendingBookings,
    revenueThisMonth,
    revenueLastMonth,
    rawTodayBookings,
  ] = await Promise.all([
    db.booking.findMany({
      where:   { businessId },
      include: { service: { select: { nameAr: true } } },
      orderBy: { date: "desc" },
      take:    20,
    }),
    db.booking.count({
      where: { businessId, createdAt: { gte: startThisMonth } },
    }),
    db.booking.count({
      where: { businessId, createdAt: { gte: startLastMonth, lt: startThisMonth } },
    }),
    db.customer.count({ where: { businessId } }),
    db.customer.count({ where: { businessId, createdAt: { gte: startThisMonth } } }),
    db.booking.count({ where: { businessId, status: "PENDING" } }),
    db.booking.aggregate({
      where: { businessId, status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: startThisMonth } },
      _sum:  { totalPrice: true },
    }),
    db.booking.aggregate({
      where: { businessId, status: { in: ["CONFIRMED", "COMPLETED"] }, createdAt: { gte: startLastMonth, lt: startThisMonth } },
      _sum:  { totalPrice: true },
    }),
    db.booking.findMany({
      where: {
        businessId,
        date:   { gte: todayStart, lt: todayEnd },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      include: { service: { select: { nameAr: true, duration: true } } },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const stats: DashboardStats = {
    bookingsThisMonth,
    bookingsLastMonth,
    totalCustomers,
    newCustomers,
    pendingBookings,
    revenueThisMonth: Number(revenueThisMonth._sum.totalPrice ?? 0),
    revenueLastMonth: Number(revenueLastMonth._sum.totalPrice ?? 0),
    currency: business.services[0]?.currency ?? "EGP",
  };

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
      stats={stats}
      recentBookings={recentBookings}
      todayBookings={todayBookings}
      openDaysCount={openDaysCount}
      isOpenToday={!!isOpenToday}
      todayHours={todayHours ? { openTime: todayHours.openTime, closeTime: todayHours.closeTime, isClosed: todayHours.isClosed } : null}
      isProfileIncomplete={isProfileIncomplete}
    />
  );
}
