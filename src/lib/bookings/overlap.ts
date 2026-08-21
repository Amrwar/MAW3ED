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
import { minutesToTime, overlaps, timeToMinutes } from "./time";

// ─── Pure helpers ────────────────────────────────────────────────────────────

// Re-exported from ./time so callers that only need the arithmetic can import
// it without pulling the Prisma client in through this module.
export { timeToMinutes, minutesToTime, overlaps };

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
  options?: {
    excludeBookingId?: string; // used during reschedule to exclude the booking being moved
    staffMemberId?:    string; // scope conflicts to a specific barber
    tableId?:          string; // scope conflicts to a specific table
  },
): Promise<boolean> {
  const { excludeBookingId, staffMemberId, tableId } = options ?? {};
  const existing = await db.booking.findMany({
    where: {
      businessId,
      date:   dateUTC,
      status: { in: ["PENDING_PAYMENT", "PENDING", "CONFIRMED"] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      ...(staffMemberId    ? { staffMemberId }                  : {}),
      ...(tableId          ? { tableId }                        : {}),
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
