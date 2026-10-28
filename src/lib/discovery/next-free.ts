import { db } from "@/lib/db";
import {
  computeAvailability,
  computeStaffedAvailability,
  type BlockRule,
  type ExistingBooking,
  type SchedulingPolicy,
  type StaffCandidate,
  type StaffDayRule,
} from "@/lib/bookings/availability";
import { LIVE_STATUSES } from "@/lib/bookings/schedule";
import { addDays, cairoDateString, cairoMinutes, dateToUTC, weekdayOf } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";
import type { DayHours } from "./hours";

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
 * is arithmetic. The discovery list loads a page of businesses the same
 * way (loadSchedules), so cards and profiles use one rule.
 */

const HORIZON_DAYS = 14;

/** The first free appointment, relative to today in Cairo. */
export interface NextSlot {
  /** Days from today. 0 = today. */
  dayOffset: number;
  /** "HH:MM" in Cairo. */
  time: string;
}

export interface Schedule {
  today: string;
  nowMinutes: number;
  policy: SchedulingPolicy;
  hours: DayHours[];
  blocks: BlockRule[];
  /** Live bookings by YYYY-MM-DD. */
  bookings: Map<string, ExistingBooking[]>;
  /**
   * Active staff, with the services each is listed for (empty: all).
   * When there are any, a time is free as the booking engine decides
   * it for a team (computeStaffedAvailability).
   */
  team: TeamMember[];
}

export interface TeamMember extends StaffCandidate {
  serviceIds: string[];
}

export async function loadSchedule(businessId: string, now: Date = new Date()): Promise<Schedule | null> {
  return (await loadSchedules([businessId], now)).get(businessId) ?? null;
}

/**
 * Schedules for several businesses in the same three queries — what the
 * discovery list uses, so a card and the profile it opens agree on the
 * next free time. They used to differ: the list ran a lighter rule that
 * ignored blocks, notice and buffers.
 */
export async function loadSchedules(businessIds: string[], now: Date = new Date()): Promise<Map<string, Schedule>> {
  const out = new Map<string, Schedule>();
  if (businessIds.length === 0) return out;

  const today = cairoDateString(now);
  const from = dateToUTC(today);
  const until = dateToUTC(addDays(today, HORIZON_DAYS));

  const [businesses, booked, blocks] = await Promise.all([
    db.business.findMany({
      where: { id: { in: businessIds } },
      select: {
        id: true,
        bufferMinutes: true,
        minNoticeMinutes: true,
        maxAdvanceDays: true,
        sameDayCutoff: true,
        availability: { select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true } },
        staffMembers: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            workingDays: true,
            hours: { select: { dayOfWeek: true, startTime: true, endTime: true, isOff: true } },
            services: { select: { serviceId: true } },
          },
        },
      },
    }),
    db.booking.findMany({
      where: { businessId: { in: businessIds }, status: { in: [...LIVE_STATUSES] }, date: { gte: from, lt: until } },
      select: {
        businessId: true,
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
        businessId: { in: businessIds },
        OR: [
          { dayOfWeek: { not: null } },
          { AND: [{ startsOn: { lt: until } }, { OR: [{ endsOn: null }, { endsOn: { gte: from } }] }] },
        ],
      },
      select: {
        businessId: true,
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

  const bookingsOf = new Map<string, Map<string, ExistingBooking[]>>();
  for (const b of booked) {
    const byDate = bookingsOf.get(b.businessId) ?? new Map<string, ExistingBooking[]>();
    bookingsOf.set(b.businessId, byDate);
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

  const blocksOf = new Map<string, BlockRule[]>();
  for (const b of blocks) {
    const list = blocksOf.get(b.businessId) ?? [];
    list.push({
      kind: b.kind,
      staffMemberId: b.staffMemberId,
      branchId: b.branchId,
      dayOfWeek: b.dayOfWeek,
      startsOn: b.startsOn ? b.startsOn.toISOString().slice(0, 10) : null,
      endsOn: b.endsOn ? b.endsOn.toISOString().slice(0, 10) : null,
      startTime: b.startTime,
      endTime: b.endTime,
    });
    blocksOf.set(b.businessId, list);
  }

  const nowMinutes = cairoMinutes(now);
  for (const business of businesses) {
    out.set(business.id, {
      today,
      nowMinutes,
      policy: {
        bufferMinutes: business.bufferMinutes,
        minNoticeMinutes: business.minNoticeMinutes,
        maxAdvanceDays: business.maxAdvanceDays,
        sameDayCutoff: business.sameDayCutoff,
      },
      hours: business.availability,
      blocks: blocksOf.get(business.id) ?? [],
      bookings: bookingsOf.get(business.id) ?? new Map(),
      team: business.staffMembers.map(({ services, ...m }) => ({
        ...m,
        serviceIds: services.map((x) => x.serviceId),
      })),
    });
  }
  return out;
}

/**
 * The first slot of the shortest service, for the business as a whole
 * ("anyone available", as the widget offers it) or for one person.
 * Null when nothing is free within the horizon, or nothing is bookable
 * at all.
 *
 * With staff, this is the booking engine's team rule, so a card never
 * advertises a time the widget then refuses: only members who do the
 * service count, and bookings nobody was given are owed by the team.
 * `serviceId` names the service the duration belongs to; without it
 * every member counts.
 */
export function firstFree(
  s: Schedule,
  durationMinutes: number | null,
  staff: { id: string; workingDays: number[]; hours: StaffDayRule[] } | null = null,
  serviceId: string | null = null,
): NextSlot | null {
  if (!durationMinutes || durationMinutes <= 0) return null;

  const team: StaffCandidate[] = s.team.filter(
    (m) => !serviceId || m.serviceIds.length === 0 || m.serviceIds.includes(serviceId),
  );
  if (staff && s.team.length > 0 && !team.some((m) => m.id === staff.id)) team.push(staff);

  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(s.today, i);
    const base = {
      date,
      dayOfWeek: weekdayOf(date),
      today: s.today,
      nowMinutes: s.nowMinutes,
      daysFromToday: i,
      serviceDuration: durationMinutes,
      policy: s.policy,
      businessHours: s.hours,
      branchId: null,
      blocks: s.blocks,
      bookings: s.bookings.get(date) ?? [],
      resourceId: null,
    };
    const { slots } =
      team.length > 0
        ? computeStaffedAvailability(base, team, staff?.id ?? null)
        : computeAvailability({
            ...base,
            staffMemberId: staff?.id ?? null,
            staffHours: staff?.hours ?? [],
            staffWorkingDays: staff?.workingDays ?? [],
          });
    const first = slots[0];
    if (first) return { dayOffset: i, time: first };
  }
  return null;
}

/** The shortest bookable service: what "next free" is measured with. */
export function shortestService<T extends { id: string; duration: number }>(services: T[]): T | null {
  return services.reduce<T | null>(
    (min, svc) => (svc.duration > 0 && (min === null || svc.duration < min.duration) ? svc : min),
    null,
  );
}

/** Shortest positive duration, or null. */
export function shortest(durations: number[]): number | null {
  return durations.reduce<number | null>((min, d) => (d > 0 && (min === null || d < min) ? d : min), null);
}
