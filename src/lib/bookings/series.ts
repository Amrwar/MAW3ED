import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { createBooking, type CreateFailure } from "./create";
import { addDays, cairoWallClock } from "./instants";
import { moveBooking } from "./state";
import { LIVE_STATUSES } from "./schedule";

/**
 * Recurring appointments (docs/architecture/ADVANCED_BOOKING_RULES.md).
 *
 * A series is the same service at the same time every `intervalWeeks`
 * weeks, `occurrences` times — bounded by the database (1–4 weeks apart,
 * 2–12 times; BookingSeries_bounds_chk), so a series can never run on
 * for ever. Each occurrence is an ordinary booking made through the
 * engine, with its own slot check and constraints; one that cannot be
 * had (the barber is off that week, the time is taken) is reported and
 * skipped, never squeezed in. Occurrence n carries the idempotency key
 * `series:<id>:<n>`, so retrying a series makes only what is missing.
 */

export const MAX_OCCURRENCES = 12;

/** Pure: the dates of a series. */
export function seriesDates(startDate: string, intervalWeeks: number, occurrences: number): string[] {
  const n = Math.max(0, Math.min(MAX_OCCURRENCES, Math.floor(occurrences)));
  const step = Math.max(1, Math.min(4, Math.floor(intervalWeeks))) * 7;
  return Array.from({ length: n }, (_, i) => addDays(startDate, i * step));
}

export interface SeriesInput {
  businessId: string;
  serviceId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  staffMemberId?: string | null;
  resourceId?: string | null;
  startDate: string;
  startTime: string;
  intervalWeeks: number;
  occurrences: number;
  createdById: string;
  notes?: string | null;
}

export interface SeriesResult {
  seriesId: string;
  made: { index: number; date: string; bookingId: string }[];
  skipped: { index: number; date: string; why: CreateFailure["kind"] }[];
}

export async function createSeries(input: SeriesInput, now: Date = new Date()): Promise<SeriesResult | { error: "bounds" | "service-not-found" }> {
  if (input.intervalWeeks < 1 || input.intervalWeeks > 4 || input.occurrences < 2 || input.occurrences > MAX_OCCURRENCES) {
    return { error: "bounds" };
  }
  const service = await db.service.findFirst({
    where: { id: input.serviceId, businessId: input.businessId },
    select: { price: true, currency: true },
  });
  if (!service) return { error: "service-not-found" };

  const series = await db.bookingSeries.create({
    data: {
      businessId: input.businessId,
      customerId: input.customerId,
      customerName: input.customerName.slice(0, 120),
      customerPhone: input.customerPhone.slice(0, 40),
      serviceId: input.serviceId,
      staffMemberId: input.staffMemberId ?? null,
      resourceId: input.resourceId ?? null,
      intervalWeeks: input.intervalWeeks,
      occurrences: input.occurrences,
      startDate: new Date(`${input.startDate}T00:00:00Z`),
      startTime: input.startTime,
      createdById: input.createdById,
    },
    select: { id: true },
  });

  const result: SeriesResult = { seriesId: series.id, made: [], skipped: [] };
  const dates = seriesDates(input.startDate, input.intervalWeeks, input.occurrences);
  for (const [index, date] of dates.entries()) {
    const r = await createBooking({
      businessId: input.businessId,
      serviceId: input.serviceId,
      customerId: input.customerId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      customerEmail: input.customerEmail ?? null,
      date,
      startTime: input.startTime,
      notes: input.notes ?? null,
      staffMemberId: input.staffMemberId ?? null,
      resourceId: input.resourceId ?? null,
      // The business made it: confirmed, nothing to pay online.
      status: "CONFIRMED",
      totalPrice: service.price,
      currency: service.currency,
      depositAmount: null,
      idempotencyKey: `series:${series.id}:${index}`,
      series: { id: series.id, index },
    }, now);
    if (r.ok) result.made.push({ index, date, bookingId: r.booking.id });
    else result.skipped.push({ index, date, why: r.failure.kind });
  }
  return result;
}

/**
 * Ends a series: every occurrence still to come is cancelled (each
 * through the state machine, so a discount, points or a package session
 * it used comes back), and the series is marked CANCELLED. Occurrences
 * already past are left as they are.
 */
export async function cancelSeries(
  businessId: string,
  seriesId: string,
  actorUserId: string,
  now: Date = new Date(),
): Promise<{ cancelled: number; changed: number } | null> {
  const series = await db.bookingSeries.findFirst({ where: { id: seriesId, businessId }, select: { id: true } });
  if (!series) return null;
  await db.bookingSeries.update({ where: { id: seriesId }, data: { status: "CANCELLED" } });
  const upcoming = await db.booking.findMany({
    // startsAt is stored on the Cairo wall clock; compared in the same frame.
    where: { seriesId, status: { in: [...LIVE_STATUSES] }, startsAt: { gt: cairoWallClock(now) } },
    select: { id: true, status: true },
    take: 50,
  });
  let cancelled = 0;
  let changed = 0;
  for (const b of upcoming) {
    try {
      const r = await moveBooking({ bookingId: b.id, from: b.status, to: "CANCELLED", by: "business", actorUserId, reason: "recurring series ended" });
      if (r.moved) cancelled++;
      else changed++;
    } catch (e) {
      log.error("[series] could not cancel an occurrence", e, { bookingId: b.id });
      changed++;
    }
  }
  return { cancelled, changed };
}
