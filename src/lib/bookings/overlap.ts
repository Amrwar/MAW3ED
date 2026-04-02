/**
 * Shared booking overlap detection helpers.
 *
 * All booking creation paths (public, manual/dashboard) and the slot generator
 * use these functions so the conflict rule can never drift between them.
 *
 * The rule: two bookings conflict when their time ranges overlap.
 * Intervals are half-open — [start, end) — so a booking ending exactly when
 * another starts is NOT a conflict (back-to-back bookings are allowed).
 */

import { db } from "@/lib/db";

// ─── Pure helpers (no DB, safe to call anywhere) ──────────────────────────────

/** Convert "HH:MM" to minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Format minutes since midnight back to "HH:MM". */
export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * Pure overlap check for two half-open intervals [aStart, aEnd) and [bStart, bEnd).
 * Returns true when the intervals share at least one minute.
 */
export function overlaps(
  aStart: number,
  aEnd:   number,
  bStart: number,
  bEnd:   number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// ─── Async conflict checker (makes one DB round-trip) ─────────────────────────

/**
 * Returns true if a candidate booking [candidateStartMin, candidateEndMin) conflicts
 * with any PENDING or CONFIRMED booking for the same business on the same date.
 *
 * Bookings that have no stored endTime fall back to startTime + service.duration,
 * matching the legacy data contract used at creation time.
 */
export async function hasBookingConflict(
  businessId:        string,
  dateUTC:           Date,
  candidateStartMin: number,
  candidateEndMin:   number,
  excludeBookingId?: string, // used during reschedule to exclude the booking being moved
): Promise<boolean> {
  const existing = await db.booking.findMany({
    where: {
      businessId,
      date:   dateUTC,
      status: { in: ["PENDING", "CONFIRMED"] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: {
      startTime: true,
      endTime:   true,
      service:   { select: { duration: true } },
    },
  });

  return existing.some((b) => {
    const bStart = timeToMinutes(b.startTime);
    const bEnd   = b.endTime
      ? timeToMinutes(b.endTime)
      : bStart + b.service.duration; // legacy fallback
    return overlaps(candidateStartMin, candidateEndMin, bStart, bEnd);
  });
}
