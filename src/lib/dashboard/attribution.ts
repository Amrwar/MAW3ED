import type { TrafficSource } from "@prisma/client";
import { db } from "@/lib/db";
import { cairoDay, cairoDayBefore } from "@/lib/attribution/day";

/**
 * How each channel is doing: who looked, and who booked.
 *
 * The two halves are counted separately and joined on the channel name,
 * not on a visitor — there is no visitor to join on, by design. So this
 * answers "Instagram sent 340 views and 18 bookings came in tagged
 * Instagram", which is the question a business actually asks, and it
 * does not pretend to follow one person from a tap to a booking.
 *
 * That distinction matters for reading the rate honestly: it is a ratio
 * of two counts over the same window, not a measured per-person
 * conversion. A visitor who looked on Monday and booked on Friday
 * counts in both halves, and one who looked twice counts twice in the
 * first. It is a signal about a channel, not an accounting of people.
 */

export interface ChannelRow {
  source: TrafficSource;
  views: number;
  bookings: number;
  /** bookings / views, or null when nobody looked. */
  rate: number | null;
}

export interface AttributionReport {
  days: number;
  rows: ChannelRow[];
  totalViews: number;
  totalBookings: number;
  /** Bookings with no channel recorded — made before this existed, or
   *  arrived without one. Reported, never spread across the channels. */
  unattributedBookings: number;
}

export async function getAttributionReport(
  businessId: string,
  days = 30,
  now: Date = new Date(),
): Promise<AttributionReport> {
  const from = cairoDayBefore(days - 1, now);
  const to = cairoDay(now);

  const [viewRows, bookingRows, unattributed] = await Promise.all([
    db.profileView.groupBy({
      by: ["source"],
      where: { businessId, day: { gte: from, lte: to } },
      _sum: { count: true },
    }),
    db.booking.groupBy({
      by: ["source"],
      where: {
        businessId,
        source: { not: null },
        createdAt: { gte: from },
        // A cancelled booking still came from somewhere. What is
        // excluded is one that never became a booking at all.
        status: { not: "FAILED_PAYMENT" },
      },
      _count: { _all: true },
    }),
    db.booking.count({
      where: {
        businessId,
        source: null,
        createdAt: { gte: from },
        status: { not: "FAILED_PAYMENT" },
      },
    }),
  ]);

  const views = new Map<TrafficSource, number>();
  for (const r of viewRows) views.set(r.source, r._sum.count ?? 0);

  const bookings = new Map<TrafficSource, number>();
  for (const r of bookingRows) {
    if (r.source) bookings.set(r.source, r._count._all);
  }

  // Every channel that showed up on either side, so a channel that sent
  // views and no bookings is visible — that is the one worth knowing
  // about.
  const seen = new Set<TrafficSource>([...views.keys(), ...bookings.keys()]);

  const rows: ChannelRow[] = [...seen]
    .map((source) => {
      const v = views.get(source) ?? 0;
      const b = bookings.get(source) ?? 0;
      return { source, views: v, bookings: b, rate: v > 0 ? b / v : null };
    })
    .sort((a, b) => b.views - a.views || b.bookings - a.bookings);

  return {
    days,
    rows,
    totalViews: [...views.values()].reduce((n, v) => n + v, 0),
    totalBookings: [...bookings.values()].reduce((n, v) => n + v, 0),
    unattributedBookings: unattributed,
  };
}
