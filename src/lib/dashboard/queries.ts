import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cairoDayEnd, cairoWallClock, cairoWallDay } from "@/lib/bookings/instants";
import {
  ABANDONED,
  LIVE_STATUSES,
  customerStats,
  newVsReturning,
  startInstant,
  tally,
  type CountableBooking,
  type CustomerStats,
} from "./stats";

/**
 * What the dashboard and the CRM read.
 *
 * Every figure comes from booking rows. There is no analytics store, no
 * nightly rollup and no estimate — if a number cannot be counted from
 * the database it is not shown.
 */

const COUNTABLE = {
  status: true,
  totalPrice: true,
  startsAt: true,
  date: true,
  customerId: true,
  createdAt: true,
} as const;

type Row = Prisma.BookingGetPayload<{ select: typeof COUNTABLE }>;

function countable(rows: Row[]): CountableBooking[] {
  return rows.map((b) => ({
    status: b.status,
    totalPrice: Number(b.totalPrice),
    startsAt: b.startsAt,
    date: b.date,
    customerId: b.customerId,
    createdAt: b.createdAt,
  }));
}

/* ─── The dashboard's headline numbers ───────────────────── */

export interface DashboardKpis {
  todayTotal: number;
  todayUpcoming: number;
  upcoming: number;
  completed: number;
  cancelled: number;
  noShows: number;
  revenue: number;
  newCustomers: number;
  returningCustomers: number;
  /** Days the window covers, so the page can label it honestly. */
  windowDays: number;
  /** True when the business has never had a booking at all. */
  neverBooked: boolean;
}

/**
 * The figures for the last `windowDays`, plus today in full.
 *
 * "Today" is the Cairo day, because that is the day the business is
 * working. The window is for the rest: a month of completed, cancelled
 * and missed appointments, and the money from the ones that happened.
 */
export async function getDashboardKpis(
  businessId: string,
  windowDays = 30,
  now: Date = new Date(),
): Promise<DashboardKpis> {
  // startsAt is Cairo wall-clock written as UTC; createdAt is a real
  // instant. Each is compared with its own kind of "now".
  const todayRange = cairoWallDay(now);
  const windowStart = new Date(cairoDayEnd(now).getTime() - windowDays * 86_400_000);

  const [todayRows, windowRows, everCount] = await Promise.all([
    db.booking.findMany({
      where: { businessId, isTest: false, startsAt: { gte: todayRange.start, lt: todayRange.end } },
      select: COUNTABLE,
    }),
    db.booking.findMany({
      where: { businessId, isTest: false, createdAt: { gte: windowStart } },
      select: COUNTABLE,
    }),
    db.booking.count({ where: { businessId, isTest: false } }),
  ]);

  // Upcoming is not bounded by the window: an appointment three months
  // out is still upcoming, and a business wants to see it.
  const futureRows = await db.booking.findMany({
    where: {
      businessId,
      isTest: false,
      status: { in: [...LIVE_STATUSES] },
      startsAt: { gte: cairoWallClock(now) },
    },
    select: COUNTABLE,
  });

  const today = tally(countable(todayRows), now);
  const window = tally(countable(windowRows), now);
  const { newCustomers, returning } = newVsReturning(countable(windowRows), windowStart);

  return {
    todayTotal: today.total,
    todayUpcoming: today.upcoming,
    upcoming: futureRows.length,
    completed: window.completed,
    cancelled: window.cancelled,
    noShows: window.noShows,
    revenue: window.revenue,
    newCustomers,
    returningCustomers: returning,
    windowDays,
    neverBooked: everCount === 0,
  };
}

/* ─── Today and upcoming, as lists ───────────────────────── */

export const BOOKING_LIST_SELECT = {
  id: true,
  reference: true,
  isTest: true,
  status: true,
  date: true,
  startTime: true,
  endTime: true,
  startsAt: true,
  totalPrice: true,
  currency: true,
  customerName: true,
  customerPhone: true,
  notes: true,
  partySize: true,
  service: { select: { nameAr: true, duration: true } },
  staffMember: { select: { nameAr: true } },
  resource: { select: { name: true, kind: true } },
  branch: { select: { nameAr: true } },
  customer: { select: { id: true } },
} as const;

export async function getTodayBookings(businessId: string, now: Date = new Date()) {
  const { start: dayStart, end: dayEnd } = cairoWallDay(now);
  return db.booking.findMany({
    where: {
      businessId,
      startsAt: { gte: dayStart, lt: dayEnd },
      status: { notIn: [...ABANDONED] },
    },
    orderBy: { startsAt: "asc" },
    select: BOOKING_LIST_SELECT,
  });
}

export async function getUpcomingBookings(
  businessId: string,
  opts: { take?: number; skip?: number } = {},
  now: Date = new Date(),
) {
  const where = {
    businessId,
    status: { in: [...LIVE_STATUSES] },
    startsAt: { gte: cairoWallClock(now) },
  };
  const [rows, total] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy: { startsAt: "asc" },
      take: opts.take ?? 25,
      skip: opts.skip ?? 0,
      select: BOOKING_LIST_SELECT,
    }),
    db.booking.count({ where }),
  ]);
  return { rows, total };
}

/* ─── The customer list ──────────────────────────────────── */

export type CustomerSort = "recent" | "visits" | "spend" | "name";

export interface CustomerListItem {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  tags: string[];
  hasNotes: boolean;
  stats: CustomerStats;
}

export interface CustomerFilters {
  q?: string;
  tag?: string;
  /** Only customers who have missed at least one appointment. */
  noShows?: boolean;
  /** Only customers with more than one completed visit. */
  returning?: boolean;
  sort?: CustomerSort;
  take?: number;
  skip?: number;
}

/**
 * Customers, with their record attached.
 *
 * The counts are computed from each customer's bookings rather than
 * read from a column, so they cannot be stale. The query loads the
 * business's customers and their bookings in two round trips, which is
 * right at this size — the alternative is a stored total that drifts
 * the first time somebody edits a booking.
 */
export async function getCustomers(
  businessId: string,
  filters: CustomerFilters = {},
  now: Date = new Date(),
): Promise<{ items: CustomerListItem[]; total: number; allTags: string[] }> {
  const q = filters.q?.trim();

  const where: Prisma.CustomerWhereInput = {
    businessId,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.tag ? { tags: { has: filters.tag } } : {}),
  };

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      notes: true,
      tags: true,
      createdAt: true,
      bookings: { select: COUNTABLE },
    },
  });

  let items: CustomerListItem[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    tags: c.tags,
    hasNotes: Boolean(c.notes?.trim()),
    stats: customerStats(countable(c.bookings), now),
  }));

  if (filters.noShows) items = items.filter((c) => c.stats.noShows > 0);
  if (filters.returning) items = items.filter((c) => c.stats.visits > 1);

  const sort = filters.sort ?? "recent";
  items.sort((a, b) => {
    switch (sort) {
      case "visits":
        return b.stats.visits - a.stats.visits;
      case "spend":
        return b.stats.revenue - a.stats.revenue;
      case "name":
        return a.name.localeCompare(b.name, "ar");
      default: {
        // Most recently active first; somebody who has never booked
        // sorts last rather than first.
        const at = (x: CustomerListItem) =>
          x.stats.nextVisit?.getTime() ?? x.stats.lastVisit?.getTime() ?? 0;
        return at(b) - at(a);
      }
    }
  });

  const total = items.length;
  const take = filters.take ?? 25;
  const skip = filters.skip ?? 0;

  // Every tag this business has ever used, for the filter bar.
  const tagRows = await db.customer.findMany({
    where: { businessId },
    select: { tags: true },
  });
  const allTags = [...new Set(tagRows.flatMap((r) => r.tags))].sort((a, b) =>
    a.localeCompare(b, "ar"),
  );

  return { items: items.slice(skip, skip + take), total, allTags };
}

/* ─── One customer ───────────────────────────────────────── */

export async function getCustomer(
  businessId: string,
  customerId: string,
  now: Date = new Date(),
) {
  const c = await db.customer.findFirst({
    // Scoped to the business: an id from another business's CRM must
    // not resolve here.
    where: { id: customerId, businessId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      notes: true,
      notesUpdatedAt: true,
      tags: true,
      createdAt: true,
      bookings: {
        orderBy: { startsAt: "desc" },
        select: {
          ...COUNTABLE,
          id: true,
          reference: true,
          startTime: true,
          endTime: true,
          currency: true,
          service: { select: { nameAr: true } },
          staffMember: { select: { nameAr: true } },
          review: { select: { rating: true } },
        },
      },
    },
  });
  if (!c) return null;

  return {
    ...c,
    stats: customerStats(countable(c.bookings), now),
    history: c.bookings.map((b) => ({
      id: b.id,
      reference: b.reference,
      status: b.status,
      at: startInstant(b),
      startTime: b.startTime,
      endTime: b.endTime,
      serviceName: b.service.nameAr,
      staffName: b.staffMember?.nameAr ?? null,
      price: Number(b.totalPrice),
      currency: b.currency,
      rating: b.review?.rating ?? null,
    })),
  };
}
