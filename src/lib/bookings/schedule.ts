import { db } from "@/lib/db";
import {
  computeAvailability,
  computeStaffedAvailability,
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
  resourceId?: string | null;
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

export interface LoadedAvailability extends AvailabilityResult {
  serviceDuration: number;
  /**
   * Who takes each offered slot, when the service is done by staff.
   * For "anyone" this is the member the booking is given to; empty when
   * the business schedules without staff.
   */
  assignments: Record<string, string>;
}

const NONE = (reason: AvailabilityResult["reason"], serviceDuration: number): LoadedAvailability => ({
  slots: [],
  reason,
  window: null,
  serviceDuration,
  assignments: {},
});

export async function loadAvailability(
  q: SlotQuery,
  now: Date = new Date(),
): Promise<LoadedAvailability> {
  const [business, service, bookings, team, resource, branch, blocks] = await Promise.all([
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
        resourceId: true,
        service: { select: { duration: true } },
      },
    }),
    // Everyone who can be booked for this service: active, and either
    // listed for it or for nothing in particular (the widget's rule).
    db.staffMember.findMany({
      where: {
        businessId: q.businessId,
        isActive: true,
        OR: [{ services: { none: {} } }, { services: { some: { serviceId: q.serviceId } } }],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        workingDays: true,
        hours: { select: { dayOfWeek: true, startTime: true, endTime: true, isOff: true } },
      },
    }),
    // Ids arrive from the client. Each has to be this business's, and
    // in use, or the booking would hold another tenant's room or a
    // resource nobody can see.
    q.resourceId
      ? db.resource.findFirst({ where: { id: q.resourceId, businessId: q.businessId, isActive: true }, select: { id: true } })
      : Promise.resolve(null),
    q.branchId
      ? db.branch.findFirst({ where: { id: q.branchId, businessId: q.businessId, isActive: true }, select: { id: true } })
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

  if (!business || !service) return NONE("no-service-duration", 0);
  if ((q.resourceId && !resource) || (q.branchId && !branch)) return NONE(null, service.duration);
  // A named member who is inactive, from another business, or does not
  // do this service. Treating them as "nobody in particular" used to
  // book them inside business hours regardless.
  //
  // Except when moving a booking they already have: the owner may since
  // have taken the service off their list, or deactivated them, and the
  // booking still has to be movable. They count, for this request only,
  // with their own hours — provided they belong to this business.
  if (q.staffMemberId && !team.some((m) => m.id === q.staffMemberId)) {
    const keeper = q.excludeBookingId
      ? await db.staffMember.findFirst({
          where: { id: q.staffMemberId, businessId: q.businessId },
          select: {
            id: true,
            workingDays: true,
            hours: { select: { dayOfWeek: true, startTime: true, endTime: true, isOff: true } },
          },
        })
      : null;
    if (!keeper) return NONE("staff-off", service.duration);
    team.push(keeper);
  }

  const today = cairoDateString(now);

  const base: Omit<AvailabilityInput, "staffMemberId" | "staffHours" | "staffWorkingDays"> = {
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
        resourceId: b.resourceId,
      };
    }),
    resourceId: q.resourceId ?? null,
  };

  // A service done by staff is the team's to answer, whether a person
  // was named or not. Without staff, the business is the one lane.
  if (team.length > 0) {
    return {
      ...computeStaffedAvailability(base, team, q.staffMemberId ?? null),
      serviceDuration: service.duration,
    };
  }
  return {
    ...computeAvailability({ ...base, staffMemberId: null, staffHours: [], staffWorkingDays: [] }),
    serviceDuration: service.duration,
    assignments: {},
  };
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
