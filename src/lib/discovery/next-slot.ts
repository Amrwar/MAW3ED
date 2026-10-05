import { minutesToTime, overlaps, timeToMinutes } from "@/lib/bookings/time";
import { dayOffsetToWeekday, isValidTime, type DayHours } from "./hours";

/**
 * The first genuinely free appointment, per business.
 *
 * This is the real thing, not an opening time: a slot is only offered
 * when the business is open, the service fits inside the remaining
 * hours, nothing is already booked over it, and it is far enough ahead
 * to be worth travelling to. The same rule the booking page applies.
 *
 * It is deliberately computed for one page of results at a time. Twelve
 * businesses is a bounded amount of arithmetic over data already
 * fetched, plus one bookings query; doing it for the whole catalogue
 * would not be.
 */

/** Minutes of lead time before a slot is offered, matching the slots API. */
const BOOKING_BUFFER_MINUTES = 30;

/** How far ahead to look before giving up. */
const HORIZON_DAYS = 14;

export interface BookedRange {
  /** Days from today, 0 = today. */
  dayOffset: number;
  startMin: number;
  endMin: number;
}

export interface NextSlotInput {
  rules: DayHours[];
  /** Shortest bookable service; null when the business has none. */
  durationMinutes: number | null;
  booked: BookedRange[];
}

export interface NextSlot {
  /** Days from today. 0 = today. */
  dayOffset: number;
  /** "HH:MM" in Cairo. */
  time: string;
}

function slotsFor(open: string, close: string, duration: number): number[] {
  if (!isValidTime(open) || !isValidTime(close)) return [];

  const start = timeToMinutes(open);
  // A business trading past midnight closes on the following day; the
  // slot generator works within one day, so the window stops at 23:59.
  const end = timeToMinutes(close) > start ? timeToMinutes(close) : 24 * 60;

  const out: number[] = [];
  for (let t = start; t + duration <= end; t += duration) out.push(t);
  return out;
}

export function findNextSlot(
  input: NextSlotInput,
  nowDay: number,
  nowTime: string,
): NextSlot | null {
  const { rules, durationMinutes, booked } = input;

  // No bookable service means nothing to offer. Saying "available
  // tomorrow at 9" for a business with no services would be a lie.
  if (!durationMinutes || durationMinutes <= 0) return null;

  const byDay = new Map(rules.map((r) => [r.dayOfWeek, r]));
  const nowMinutes = timeToMinutes(nowTime);

  for (let offset = 0; offset < HORIZON_DAYS; offset++) {
    const rule = byDay.get(dayOffsetToWeekday(nowDay, offset));
    if (!rule || rule.isClosed) continue;

    const dayBookings = booked.filter((b) => b.dayOffset === offset);

    for (const start of slotsFor(rule.openTime, rule.closeTime, durationMinutes)) {
      if (offset === 0 && start < nowMinutes + BOOKING_BUFFER_MINUTES) continue;

      const end = start + durationMinutes;
      const taken = dayBookings.some((b) => overlaps(start, end, b.startMin, b.endMin));
      if (taken) continue;

      return { dayOffset: offset, time: minutesToTime(start) };
    }
  }

  return null;
}
