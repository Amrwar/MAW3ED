import type { BookingStatus } from "@prisma/client";
import { cairoWallClock } from "@/lib/bookings/instants";

/**
 * Counting what actually happened.
 *
 * Every number the dashboard and the CRM show is derived here from
 * booking rows. Nothing is estimated, projected or smoothed, and
 * nothing is stored — a stored total is a total that drifts the first
 * time a booking is edited.
 *
 * The rules, in one place because they have to agree everywhere:
 *
 *   - a *visit* is a COMPLETED booking. Not a confirmed one: a booking
 *     that was confirmed and then missed is not a visit.
 *   - *revenue* counts COMPLETED bookings only. Money is recognised
 *     when the work was done, not when it was booked — counting
 *     confirmed-but-future bookings as revenue would be a forecast
 *     wearing a fact's clothes.
 *   - a *no-show* is NO_SHOW, which only a business can set.
 *   - *cancelled* is CANCELLED, whoever cancelled it.
 *   - PENDING_PAYMENT and FAILED_PAYMENT are not bookings anybody
 *     made; they are abandoned checkouts and are counted nowhere.
 */

/** The statuses that represent a live, intended appointment. */
export const LIVE_STATUSES: readonly BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
];

/** Statuses that never represent an appointment anybody committed to. */
export const ABANDONED: readonly BookingStatus[] = ["PENDING_PAYMENT", "FAILED_PAYMENT"];

export interface CountableBooking {
  status: BookingStatus;
  /** Decimal from Prisma arrives as something Number() handles. */
  totalPrice: number;
  startsAt: Date | null;
  date: Date;
  customerId: string | null;
  createdAt: Date;
}

export interface Tally {
  /** COMPLETED. */
  completed: number;
  cancelled: number;
  noShows: number;
  /** Live and still ahead of the moment asked about. */
  upcoming: number;
  /** Sum of totalPrice over COMPLETED only. */
  revenue: number;
  /** Everything except abandoned checkouts. */
  total: number;
}

export function tally(bookings: CountableBooking[], now: Date = new Date()): Tally {
  // startsAt is Cairo wall-clock written as UTC; "now" has to be too.
  const wall = cairoWallClock(now);
  const t: Tally = {
    completed: 0,
    cancelled: 0,
    noShows: 0,
    upcoming: 0,
    revenue: 0,
    total: 0,
  };

  for (const b of bookings) {
    if (ABANDONED.includes(b.status)) continue;
    t.total++;

    switch (b.status) {
      case "COMPLETED":
        t.completed++;
        t.revenue += b.totalPrice;
        break;
      case "CANCELLED":
        t.cancelled++;
        break;
      case "NO_SHOW":
        t.noShows++;
        break;
      default:
        // Live. Upcoming only while it has not started yet.
        if (startInstant(b) > wall) t.upcoming++;
    }
  }

  return t;
}

/**
 * When a booking starts.
 *
 * `startsAt` is what everything should use. It is Cairo wall-clock
 * written as if it were UTC (lib/bookings/instants), so it is compared
 * with cairoWallClock(now), never with `now` itself.
 * Rows written before that column existed have only a date, and
 * treating those as starting at midnight is the conservative reading —
 * it makes an old booking look past rather than pretending it is still
 * ahead.
 */
export function startInstant(b: { startsAt: Date | null; date: Date }): Date {
  return b.startsAt ?? b.date;
}

/* ─── One customer ───────────────────────────────────────── */

export interface CustomerStats extends Tally {
  /** COMPLETED bookings; the number a business means by "visits". */
  visits: number;
  firstSeen: Date | null;
  lastVisit: Date | null;
  nextVisit: Date | null;
  /**
   * Missed appointments as a share of the ones they were expected at.
   * Null when they have never been expected at one — a new customer is
   * not a 0% risk, they are an unknown.
   */
  noShowRate: number | null;
}

export function customerStats(
  bookings: CountableBooking[],
  now: Date = new Date(),
): CustomerStats {
  const t = tally(bookings, now);
  const wall = cairoWallClock(now);

  let firstSeen: Date | null = null;
  let lastVisit: Date | null = null;
  let nextVisit: Date | null = null;

  for (const b of bookings) {
    if (ABANDONED.includes(b.status)) continue;
    const at = startInstant(b);

    if (!firstSeen || b.createdAt < firstSeen) firstSeen = b.createdAt;
    if (b.status === "COMPLETED" && (!lastVisit || at > lastVisit)) lastVisit = at;
    if (
      LIVE_STATUSES.includes(b.status) &&
      at > wall &&
      (!nextVisit || at < nextVisit)
    ) {
      nextVisit = at;
    }
  }

  // The appointments they were expected at: ones they attended plus
  // ones they did not. A cancellation is not a missed appointment —
  // they told the business.
  const expected = t.completed + t.noShows;

  return {
    ...t,
    visits: t.completed,
    firstSeen,
    lastVisit,
    nextVisit,
    noShowRate: expected > 0 ? t.noShows / expected : null,
  };
}

/* ─── New against returning ──────────────────────────────── */

/**
 * A customer is "returning" in a period if they had already booked
 * before it started, and "new" if their first booking falls inside it.
 *
 * Counted by customer, not by booking: somebody who came three times
 * this month is one returning customer, not three.
 */
export function newVsReturning(
  bookings: CountableBooking[],
  periodStart: Date,
): { newCustomers: number; returning: number } {
  const firstEver = new Map<string, Date>();
  for (const b of bookings) {
    if (ABANDONED.includes(b.status) || !b.customerId) continue;
    const seen = firstEver.get(b.customerId);
    if (!seen || b.createdAt < seen) firstEver.set(b.customerId, b.createdAt);
  }

  const inPeriod = new Set<string>();
  for (const b of bookings) {
    if (ABANDONED.includes(b.status) || !b.customerId) continue;
    if (b.createdAt >= periodStart) inPeriod.add(b.customerId);
  }

  let newCustomers = 0;
  let returning = 0;
  for (const id of inPeriod) {
    const first = firstEver.get(id);
    if (first && first >= periodStart) newCustomers++;
    else returning++;
  }

  return { newCustomers, returning };
}
