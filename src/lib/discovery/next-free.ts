import { db } from "@/lib/db";
import {
  computeAvailability,
  type BlockRule,
  type ExistingBooking,
  type SchedulingPolicy,
  type StaffDayRule,
} from "@/lib/bookings/availability";
import { LIVE_STATUSES } from "@/lib/bookings/schedule";
import { addDays, cairoDateString, cairoMinutes, dateToUTC, weekdayOf } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";
import type { DayHours } from "./hours";
import type { NextSlot } from "./next-slot";

/**
 * The first free appointment for one business, or one person at it, as
 * the booking engine itself would offer it.
 *
 * A profile advertising "next free 15:30" must not be refused by the
 * booking widget a moment later, so this runs computeAvailability — the
 * function behind the slots endpoint and booking creation — day by day
 * over the next fortnight: time blocks, vacations, minimum notice, the
 * same-day cutoff, the advance window, buffers and every booking still
 * holding its slot (PENDING_PAYMENT included) all apply.
 *
 * Everything is fetched once, in three queries; each person after that
 * is arithmetic. The discovery list keeps its lighter findNextSlot,
 * which is computed for a page of businesses at a time.
 */

const HORIZON_DAYS = 14;

export interface Schedule {
  today: string;
  nowMinutes: number;
  policy: SchedulingPolicy;
  hours: DayHours[];
  blocks: BlockRule[];
  /** Live bookings by YYYY-MM-DD. */
  bookings: Map<string, ExistingBooking[]>;
}

export async function loadSchedule(businessId: string, now: Date = new Date()): Promise<Schedule | null> {
  const today = cairoDateString(now);
  const from = dateToUTC(today);
  const until = dateToUTC(addDays(today, HORIZON_DAYS));

  const [business, booked, blocks] = await Promise.all([
    db.business.findUnique({
      where: { id: businessId },
      select: {
        bufferMinutes: true,
        minNoticeMinutes: true,
        maxAdvanceDays: true,
        sameDayCutoff: true,
        availability: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
      },
    }),
    db.booking.findMany({
      where: { businessId, status: { in: [...LIVE_STATUSES] }, date: { gte: from, lt: until } },
      select: {
        date: true,
        startTime: true,
        endTime: true,
        staffMemberId: true,
        resourceId: true,
        service: { select: { duration: true } },
      },
    }),
    db.timeBlock.findMany({
      where: {
        businessId,
        OR: [
          { dayOfWeek: { not: null } },
          { AND: [{ startsOn: { lt: until } }, { OR: [{ endsOn: null }, { endsOn: { gte: from } }] }] },
        ],
      },
      select: {
        kind: true,
        staffMemberId: true,
        branchId: true,
        dayOfWeek: true,
        startsOn: true,
        endsOn: true,
        startTime: true,
        endTime: true,
      },
    }),
  ]);
  if (!business) return null;

  const byDate = new Map<string, ExistingBooking[]>();
  for (const b of booked) {
    const key = b.date.toISOString().slice(0, 10);
    const startMin = timeToMinutes(b.startTime);
    const list = byDate.get(key) ?? [];
    list.push({
      startMin,
      endMin: b.endTime ? timeToMinutes(b.endTime) : startMin + b.service.duration,
      staffMemberId: b.staffMemberId,
      resourceId: b.resourceId,
    });
    byDate.set(key, list);
  }

  return {
    today,
    nowMinutes: cairoMinutes(now),
    policy: {
      bufferMinutes: business.bufferMinutes,
      minNoticeMinutes: business.minNoticeMinutes,
      maxAdvanceDays: business.maxAdvanceDays,
      sameDayCutoff: business.sameDayCutoff,
    },
    hours: business.availability,
    blocks: blocks.map((b) => ({
      kind: b.kind,
      staffMemberId: b.staffMemberId,
      branchId: b.branchId,
      dayOfWeek: b.dayOfWeek,
      startsOn: b.startsOn ? b.startsOn.toISOString().slice(0, 10) : null,
      endsOn: b.endsOn ? b.endsOn.toISOString().slice(0, 10) : null,
      startTime: b.startTime,
      endTime: b.endTime,
    })),
    bookings: byDate,
  };
}

/**
 * The first slot of the shortest service, for the business as a whole
 * (staff null: "anyone available", as the widget offers it) or for one
 * person. Null when nothing is free within the horizon, or nothing is
 * bookable at all.
 */
export function firstFree(
  s: Schedule,
  durationMinutes: number | null,
  staff: { id: string; workingDays: number[]; hours: StaffDayRule[] } | null = null,
): NextSlot | null {
  if (!durationMinutes || durationMinutes <= 0) return null;
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(s.today, i);
    const { slots } = computeAvailability({
      date,
      dayOfWeek: weekdayOf(date),
      today: s.today,
      nowMinutes: s.nowMinutes,
      daysFromToday: i,
      serviceDuration: durationMinutes,
      policy: s.policy,
      businessHours: s.hours,
      staffMemberId: staff?.id ?? null,
      staffHours: staff?.hours ?? [],
      staffWorkingDays: staff?.workingDays ?? [],
      branchId: null,
      blocks: s.blocks,
      bookings: s.bookings.get(date) ?? [],
      resourceId: null,
    });
    const first = slots[0];
    if (first) return { dayOffset: i, time: first };
  }
  return null;
}

/** Shortest positive duration, or null. */
export function shortest(durations: number[]): number | null {
  return durations.reduce<number | null>((min, d) => (d > 0 && (min === null || d < min) ? d : min), null);
}
