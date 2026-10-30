import { venuePauses } from "@/lib/venues/pause";
import { db } from "@/lib/db";
import {
  computeAvailability,
  computeStaffedAvailability,
  type AvailabilityInput,
  type AvailabilityResult,
  type BlockRule,
  type StaffCandidate,
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
  /**
   * How many people are coming. With a resource named, it has to seat
   * them; without one, at a business whose resources count seats, the
   * smallest free one that does is chosen.
   */
  partySize?: number | null;
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
  /**
   * Which room, chair or table each offered slot is held on, when the
   * business has resources and none was named: the smallest one that
   * fits the party and is free then. Empty when a resource was named
   * (the booking holds that one) or the business has none.
   */
  resourceAssignments: Record<string, string>;
}

const NONE = (reason: AvailabilityResult["reason"], serviceDuration: number): LoadedAvailability => ({
  slots: [],
  reason,
  window: null,
  serviceDuration,
  assignments: {},
  resourceAssignments: {},
});

interface ResourceRow {
  id: string;
  capacity: number | null;
  branchId: string | null;
}

export async function loadAvailability(
  q: SlotQuery,
  now: Date = new Date(),
): Promise<LoadedAvailability> {
  const [business, service, bookings, team, resources, branch, blocks] = await Promise.all([
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
    // The business's rooms, chairs and tables. Ids arrive from the
    // client, so a named one has to be found here — this business's,
    // and in use — or the booking would hold another tenant's room or a
    // resource nobody can see. Smallest first, so "any table" seats a
    // couple at a table for two rather than the one for eight.
    db.resource.findMany({
      where: { businessId: q.businessId, isActive: true },
      orderBy: [{ capacity: { sort: "asc", nulls: "last" } }, { sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, capacity: true, branchId: true },
    }),
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
  if (q.branchId && !branch) return NONE(null, service.duration);
  // A venue the business trades in has closed or paused bookings that
  // day (lib/venues/pause.ts). Asked after the cheap checks, and almost
  // always answered by one indexed lookup that finds no listing.
  if (await venuePauses(q.businessId, q.branchId ?? null, q.date)) return NONE("venue-closed", service.duration);

  // ── Which resource(s) the booking may hold ──────────────────
  const party = q.partySize && q.partySize > 0 ? q.partySize : null;
  const inBranch = (r: ResourceRow) => !q.branchId || !r.branchId || r.branchId === q.branchId;
  const seats = (r: ResourceRow) => r.capacity === null || r.capacity >= (party ?? 1);

  let lanes: (string | null)[];
  if (q.resourceId) {
    const named = resources.find((r) => r.id === q.resourceId);
    if (!named || !inBranch(named)) return NONE(null, service.duration);
    // A table for four is not offered to a party of six, whatever the
    // client sent.
    if (!seats(named)) return NONE("party-too-large", service.duration);
    lanes = [named.id];
  } else if (resources.length > 0) {
    // No resource named at a business that has them: the booking still
    // has to hold one, or it would hold nothing and two parties would
    // meet at one table. Every resource that fits is a candidate; the
    // first free one in capacity order takes each slot.
    const fitting = resources.filter((r) => inBranch(r) && seats(r));
    if (fitting.length === 0) return NONE(party ? "party-too-large" : null, service.duration);
    lanes = fitting.map((r) => r.id);
  } else {
    lanes = [null];
  }

  // A named member who is inactive, from another business, or does not
  // do this service. Treating them as "nobody in particular" used to
  // book them inside business hours regardless.
  //
  // Except when moving a booking they already have: the owner may since
  // have taken the service off their list, or deactivated them, and the
  // booking still has to be movable. They count, for this request only,
  // with their own hours — provided they belong to this business.
  const staff: StaffCandidate[] = [...team];
  if (q.staffMemberId && !staff.some((m) => m.id === q.staffMemberId)) {
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
    staff.push(keeper);
  }

  const today = cairoDateString(now);

  const base: Omit<AvailabilityInput, "staffMemberId" | "staffHours" | "staffWorkingDays" | "resourceId"> = {
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
      let endMin = b.endTime ? timeToMinutes(b.endTime) : startMin + b.service.duration;
      // A legacy row whose endTime wrapped past midnight.
      if (endMin <= startMin) endMin = startMin + b.service.duration;
      return { startMin, endMin, staffMemberId: b.staffMemberId, resourceId: b.resourceId };
    }),
  };

  // A service done by staff is the team's to answer, whether a person
  // was named or not. Without staff, the business is the one lane.
  const run = (resourceId: string | null) =>
    staff.length > 0
      ? computeStaffedAvailability({ ...base, resourceId }, staff, q.staffMemberId ?? null)
      : { ...computeAvailability({ ...base, resourceId, staffMemberId: null, staffHours: [], staffWorkingDays: [] }), assignments: {} as Record<string, string> };

  // One lane: the answer is that lane's. When the lane is a resource the
  // customer did not name — the only table that seats the party — the
  // booking still has to be given it.
  if (lanes.length === 1) {
    const r = run(lanes[0]);
    const only = lanes[0];
    const resourceAssignments: Record<string, string> =
      !q.resourceId && only ? Object.fromEntries(r.slots.map((t) => [t, only])) : {};
    return { ...r, serviceDuration: service.duration, resourceAssignments };
  }

  // Several candidate resources: a time is offered when any of them is
  // free, and goes to the first (smallest) that is.
  const runs = lanes.map((id) => ({ id: id as string, result: run(id) }));
  const times = [...new Set(runs.flatMap((r) => r.result.slots))].sort((a, b) => timeToMinutes(a) - timeToMinutes(b));
  const assignments: Record<string, string> = {};
  const resourceAssignments: Record<string, string> = {};
  for (const t of times) {
    const first = runs.find((r) => r.result.slots.includes(t))!;
    resourceAssignments[t] = first.id;
    if (first.result.assignments[t]) assignments[t] = first.result.assignments[t];
  }
  const reasons = new Set(runs.map((r) => r.result.reason));
  const windows = runs.map((r) => r.result.window).filter((w): w is NonNullable<typeof w> => w !== null);
  return {
    slots: times,
    reason: times.length === 0 && reasons.size === 1 ? [...reasons][0] : null,
    window: windows.length
      ? { start: Math.min(...windows.map((w) => w.start)), end: Math.max(...windows.map((w) => w.end)) }
      : null,
    serviceDuration: service.duration,
    assignments,
    resourceAssignments,
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
