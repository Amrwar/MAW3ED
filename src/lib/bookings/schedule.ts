import { db } from "@/lib/db";
import {
  computeAvailability,
  type AvailabilityInput,
  type AvailabilityResult,
  type BlockRule,
} from "./availability";
import {
  cairoDateString,
  cairoMinutes,
  dateToUTC,
  daysBetween,
  weekdayOf,
} from "./instants";
import { timeToMinutes } from "./time";

/**
 * Loads a day's scheduling facts and runs the engine over them.
 *
 * One function, called by the slots endpoint and again by the create
 * endpoint. That is the point: the times offered to a customer and the
 * times the server will accept come out of the same call, so a client
 * cannot book something it was never shown, and a slot that went stale
 * between the two is caught.
 */

export interface SlotQuery {
  businessId: string;
  serviceId: string;
  /** YYYY-MM-DD */
  date: string;
  staffMemberId?: string | null;
  tableId?: string | null;
  branchId?: string | null;
  /** Ignores this booking when checking collisions — used by reschedule. */
  excludeBookingId?: string | null;
}

/** Statuses that still hold their slot. Mirrors the database constraint. */
export const LIVE_STATUSES = [
  "PENDING_PAYMENT",
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
] as const;

export async function loadAvailability(
  q: SlotQuery,
  now: Date = new Date(),
): Promise<AvailabilityResult & { serviceDuration: number }> {
  const [business, service, bookings, staff, blocks] = await Promise.all([
    db.business.findUnique({
      where: { id: q.businessId },
      select: {
        bufferMinutes: true,
        minNoticeMinutes: true,
        maxAdvanceDays: true,
        sameDayCutoff: true,
        availability: {
          select: { dayOfWeek: true, openTime: true, closeTime: true, isClosed: true },
        },
      },
    }),
    db.service.findFirst({
      where: { id: q.serviceId, businessId: q.businessId, isAvailable: true },
      select: { duration: true },
    }),
    db.booking.findMany({
      where: {
        businessId: q.businessId,
        date: dateToUTC(q.date),
        status: { in: [...LIVE_STATUSES] },
        ...(q.excludeBookingId ? { id: { not: q.excludeBookingId } } : {}),
      },
      select: {
        startTime: true,
        endTime: true,
        staffMemberId: true,
        tableId: true,
        service: { select: { duration: true } },
      },
    }),
    q.staffMemberId
      ? db.staffMember.findFirst({
          where: { id: q.staffMemberId, businessId: q.businessId, isActive: true },
          select: {
            workingDays: true,
            hours: { select: { dayOfWeek: true, startTime: true, endTime: true, isOff: true } },
          },
        })
      : Promise.resolve(null),
    db.timeBlock.findMany({
      where: {
        businessId: q.businessId,
        // Weekly blocks always apply; dated ones only when they span the
        // day being asked about.
        OR: [
          { dayOfWeek: { not: null } },
          {
            AND: [
              { startsOn: { lte: dateToUTC(q.date) } },
              { OR: [{ endsOn: null }, { endsOn: { gte: dateToUTC(q.date) } }] },
            ],
          },
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

  if (!business || !service) {
    return { slots: [], reason: "no-service-duration", window: null, serviceDuration: 0 };
  }

  const today = cairoDateString(now);

  const input: AvailabilityInput = {
    date: q.date,
    dayOfWeek: weekdayOf(q.date),
    today,
    nowMinutes: cairoMinutes(now),
    daysFromToday: daysBetween(today, q.date),

    serviceDuration: service.duration,
    policy: {
      bufferMinutes: business.bufferMinutes,
      minNoticeMinutes: business.minNoticeMinutes,
      maxAdvanceDays: business.maxAdvanceDays,
      sameDayCutoff: business.sameDayCutoff,
    },

    businessHours: business.availability,
    staffMemberId: q.staffMemberId ?? null,
    staffHours: staff?.hours ?? [],
    staffWorkingDays: staff?.workingDays ?? [],
    branchId: q.branchId ?? null,
    blocks: blocks.map(
      (b): BlockRule => ({
        kind: b.kind,
        staffMemberId: b.staffMemberId,
        branchId: b.branchId,
        dayOfWeek: b.dayOfWeek,
        startsOn: b.startsOn ? b.startsOn.toISOString().slice(0, 10) : null,
        endsOn: b.endsOn ? b.endsOn.toISOString().slice(0, 10) : null,
        startTime: b.startTime,
        endTime: b.endTime,
      }),
    ),
    bookings: bookings.map((b) => {
      const startMin = timeToMinutes(b.startTime);
      return {
        startMin,
        endMin: b.endTime ? timeToMinutes(b.endTime) : startMin + b.service.duration,
        staffMemberId: b.staffMemberId,
        tableId: b.tableId,
      };
    }),
    tableId: q.tableId ?? null,
  };

  return { ...computeAvailability(input), serviceDuration: service.duration };
}

/**
 * The next days that have at least one free slot.
 *
 * Used by the date step so a customer is not left clicking through a
 * fortnight of closed days. Bounded by maxAdvanceDays regardless of what
 * is asked for.
 */
export async function loadOpenDays(
  q: Omit<SlotQuery, "date">,
  fromDate: string,
  horizonDays: number,
  now: Date = new Date(),
): Promise<{ date: string; slotCount: number }[]> {
  const out: { date: string; slotCount: number }[] = [];
  const base = dateToUTC(fromDate);

  for (let i = 0; i < horizonDays; i++) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);

    const { slots } = await loadAvailability({ ...q, date }, now);
    out.push({ date, slotCount: slots.length });
  }

  return out;
}
