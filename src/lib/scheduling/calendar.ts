import type { BookingStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { dateToUTC } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";

/**
 * What the owner's calendar needs for a range of days.
 *
 * One query for the bookings and one for the time blocks, whatever the
 * view. A month is 31 days of appointments, not 31 round trips.
 */

export type CalendarView = "day" | "week" | "month";

export const CALENDAR_VIEWS: CalendarView[] = ["day", "week", "month"];

export function parseView(raw: string | undefined): CalendarView {
  return CALENDAR_VIEWS.includes(raw as CalendarView) ? (raw as CalendarView) : "day";
}

export interface CalendarFilters {
  staffMemberId: string | null;
  serviceId: string | null;
  branchId: string | null;
  resourceId: string | null;
  /** Empty means every status that is not cancelled. */
  statuses: BookingStatus[];
}

export const EMPTY_FILTERS: CalendarFilters = {
  staffMemberId: null,
  serviceId: null,
  branchId: null,
  resourceId: null,
  statuses: [],
};

export interface CalendarEntry {
  id: string;
  reference: string | null;
  status: string;
  /** YYYY-MM-DD */
  date: string;
  startTime: string;
  endTime: string;
  startMin: number;
  endMin: number;
  durationMinutes: number;
  customerName: string;
  customerPhone: string;
  serviceId: string;
  serviceName: string;
  staffMemberId: string | null;
  staffName: string | null;
  resourceId: string | null;
  resourceName: string | null;
  branchId: string | null;
  branchName: string | null;
  partySize: number | null;
  totalPrice: number;
  currency: string;
  notes: string | null;
}

/** A stretch of time the owner has closed off, drawn behind the bookings. */
export interface CalendarBlock {
  id: string;
  kind: string;
  reason: string | null;
  staffMemberId: string | null;
  branchId: string | null;
  /** Null for an all-day block. */
  startMin: number | null;
  endMin: number | null;
  /** Which dates in the range this block covers. */
  dates: string[];
}

/* ─── Range helpers ──────────────────────────────────────── */

/** The dates a view covers, given the date it is anchored on. */
export function rangeFor(view: CalendarView, anchor: string): { from: string; to: string } {
  const d = dateToUTC(anchor);

  if (view === "day") return { from: anchor, to: anchor };

  if (view === "week") {
    // Weeks start on Saturday in Egypt, not Sunday or Monday.
    const dow = d.getUTCDay();
    const back = (dow + 1) % 7;
    const start = new Date(d.getTime() - back * 86_400_000);
    const end = new Date(start.getTime() + 6 * 86_400_000);
    return { from: iso(start), to: iso(end) };
  }

  // Month: the calendar grid, so it runs from the Saturday before the
  // first to the Friday after the last.
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const gridStart = new Date(first.getTime() - ((first.getUTCDay() + 1) % 7) * 86_400_000);
  const trailing = (5 - last.getUTCDay() + 7) % 7;
  const gridEnd = new Date(last.getTime() + trailing * 86_400_000);
  return { from: iso(gridStart), to: iso(gridEnd) };
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Every date in an inclusive range. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = dateToUTC(to).getTime();
  for (let t = dateToUTC(from).getTime(); t <= end; t += 86_400_000) {
    out.push(iso(new Date(t)));
  }
  return out;
}

/* ─── Loading ────────────────────────────────────────────── */

/** Cancelled and failed appointments are hidden unless asked for. */
const DEFAULT_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "PENDING",
  "CONFIRMED",
  "ARRIVED",
  "IN_PROGRESS",
  "COMPLETED",
  "NO_SHOW",
];

export async function loadCalendar(
  businessId: string,
  view: CalendarView,
  anchor: string,
  filters: CalendarFilters = EMPTY_FILTERS,
): Promise<{ from: string; to: string; entries: CalendarEntry[]; blocks: CalendarBlock[] }> {
  const { from, to } = rangeFor(view, anchor);

  const [rows, blockRows] = await Promise.all([
    db.booking.findMany({
      where: {
        businessId,
        date: { gte: dateToUTC(from), lte: dateToUTC(to) },
        status: { in: filters.statuses.length > 0 ? filters.statuses : DEFAULT_STATUSES },
        ...(filters.staffMemberId ? { staffMemberId: filters.staffMemberId } : {}),
        ...(filters.serviceId ? { serviceId: filters.serviceId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.resourceId ? { resourceId: filters.resourceId } : {}),
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      select: {
        id: true,
        reference: true,
        status: true,
        date: true,
        startTime: true,
        endTime: true,
        customerName: true,
        customerPhone: true,
        serviceId: true,
        staffMemberId: true,
        resourceId: true,
        branchId: true,
        partySize: true,
        totalPrice: true,
        currency: true,
        notes: true,
        service: { select: { nameAr: true, duration: true } },
        staffMember: { select: { nameAr: true } },
        resource: { select: { name: true } },
        branch: { select: { nameAr: true } },
      },
    }),
    db.timeBlock.findMany({
      where: {
        businessId,
        OR: [
          { dayOfWeek: { not: null } },
          {
            AND: [
              { startsOn: { lte: dateToUTC(to) } },
              { OR: [{ endsOn: null }, { endsOn: { gte: dateToUTC(from) } }] },
            ],
          },
        ],
        ...(filters.staffMemberId ? { OR: [{ staffMemberId: null }, { staffMemberId: filters.staffMemberId }] } : {}),
      },
      select: {
        id: true,
        kind: true,
        reason: true,
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

  const entries: CalendarEntry[] = rows.map((b) => {
    const startMin = timeToMinutes(b.startTime);
    const endMin = b.endTime ? timeToMinutes(b.endTime) : startMin + b.service.duration;
    return {
      id: b.id,
      reference: b.reference,
      status: b.status,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      endTime: b.endTime ?? "",
      startMin,
      endMin,
      durationMinutes: endMin - startMin,
      customerName: b.customerName,
      customerPhone: b.customerPhone,
      serviceId: b.serviceId,
      serviceName: b.service.nameAr,
      staffMemberId: b.staffMemberId,
      staffName: b.staffMember?.nameAr ?? null,
      resourceId: b.resourceId,
      resourceName: b.resource?.name ?? null,
      branchId: b.branchId,
      branchName: b.branch?.nameAr ?? null,
      partySize: b.partySize,
      totalPrice: Number(b.totalPrice),
      currency: b.currency,
      notes: b.notes,
    };
  });

  const span = datesBetween(from, to);

  const blocks: CalendarBlock[] = blockRows.map((b) => {
    const dates = span.filter((date) => {
      if (b.dayOfWeek !== null) return dateToUTC(date).getUTCDay() === b.dayOfWeek;
      if (!b.startsOn) return false;
      const endsOn = b.endsOn ? b.endsOn.toISOString().slice(0, 10) : b.startsOn.toISOString().slice(0, 10);
      return date >= b.startsOn.toISOString().slice(0, 10) && date <= endsOn;
    });

    return {
      id: b.id,
      kind: b.kind,
      reason: b.reason,
      staffMemberId: b.staffMemberId,
      branchId: b.branchId,
      startMin: b.startTime ? timeToMinutes(b.startTime) : null,
      endMin: b.endTime ? timeToMinutes(b.endTime) : null,
      dates,
    };
  });

  return { from, to, entries, blocks };
}

/* ─── Layout ─────────────────────────────────────────────── */

export interface LaidOutEntry<T> {
  entry: T;
  /** 0-based column among the overlapping group. */
  column: number;
  /** How many columns that group needs. */
  columns: number;
}

/**
 * Places overlapping appointments side by side.
 *
 * Two bookings at the same time on a staff-less business are a genuine
 * double booking and the calendar should show both, not hide one behind
 * the other. The same layout handles a business with three chairs
 * running three appointments at once.
 */
export function layoutDay<T extends { startMin: number; endMin: number }>(
  entries: T[],
): LaidOutEntry<T>[] {
  const sorted = [...entries].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out: LaidOutEntry<T>[] = [];

  let cluster: T[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (cluster.length === 0) return;
    // Greedy column assignment: the first column whose last booking has
    // finished takes the next one.
    const columnEnds: number[] = [];
    const placed: { entry: T; column: number }[] = [];

    for (const e of cluster) {
      let col = columnEnds.findIndex((end) => end <= e.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(e.endMin);
      } else {
        columnEnds[col] = e.endMin;
      }
      placed.push({ entry: e, column: col });
    }

    for (const p of placed) out.push({ ...p, columns: columnEnds.length });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const e of sorted) {
    if (cluster.length > 0 && e.startMin >= clusterEnd) flush();
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  flush();

  return out;
}
