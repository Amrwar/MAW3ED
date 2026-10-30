import { minutesToTime, overlaps, timeToMinutes } from "./time";

/**
 * The availability engine.
 *
 * Everything below is pure: it takes the day's rules and the day's
 * bookings and returns the slots that are genuinely free. Nothing here
 * reads the database, so every rule can be tested directly, and the
 * server can run the identical calculation when a booking is submitted
 * rather than trusting whatever the browser offers.
 *
 * The rules it applies, in the order they narrow the day:
 *
 *   1  business hours          the doors are open
 *   2  staff hours             that person works this day, these hours
 *   3  branch                  blocks scoped to a location
 *   4  holidays and closures   dated, whole-business
 *   5  staff vacation          dated, one person
 *   6  breaks                  weekly, e.g. lunch
 *   7  service duration        the appointment has to fit
 *   8  buffer time             and leave a gap after it
 *   9  existing bookings       including their buffers
 *  10  minimum notice          not in the next N minutes
 *  11  maximum advance         not beyond N days out
 *  12  same-day cutoff         after HH:MM, today is closed
 */

/** Minutes from midnight, half-open: [start, end). */
export interface Interval {
  start: number;
  end: number;
}

export interface DayHoursRule {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface StaffDayRule {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isOff: boolean;
}

export interface BlockRule {
  kind: "BREAK" | "HOLIDAY" | "VACATION" | "CLOSURE";
  staffMemberId: string | null;
  branchId: string | null;
  /** Weekly form. */
  dayOfWeek: number | null;
  /** Dated form, inclusive, as YYYY-MM-DD. */
  startsOn: string | null;
  endsOn: string | null;
  /** Null means the whole day. */
  startTime: string | null;
  endTime: string | null;
}

export interface ExistingBooking {
  startMin: number;
  endMin: number;
  staffMemberId: string | null;
  resourceId: string | null;
}

export interface SchedulingPolicy {
  bufferMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  /** "HH:MM" in Cairo, or null. */
  sameDayCutoff: string | null;
}

export interface AvailabilityInput {
  /** The day being asked about, YYYY-MM-DD. */
  date: string;
  /** 0 = Sunday, for that date. */
  dayOfWeek: number;
  /** Today's date in Cairo, YYYY-MM-DD. */
  today: string;
  /** Minutes from midnight, Cairo, right now. */
  nowMinutes: number;
  /** Whole days from today to `date`. Negative for the past. */
  daysFromToday: number;

  serviceDuration: number;
  policy: SchedulingPolicy;

  businessHours: DayHoursRule[];
  /** Null when no particular person was asked for. */
  staffMemberId: string | null;
  staffHours: StaffDayRule[];
  /** Days this member works at all. Empty means "no restriction". */
  staffWorkingDays: number[];
  branchId: string | null;
  blocks: BlockRule[];
  /** Live bookings for this business on this date. */
  bookings: ExistingBooking[];
  /**
   * Scopes collision to one room, chair, table or machine. A resource
   * is held by one booking at a time whatever it is called.
   */
  resourceId: string | null;
}

export type UnavailableReason =
  | "past"
  | "too-far-ahead"
  | "same-day-cutoff"
  | "business-closed"
  /** The venue the business is in has closed, or paused bookings, that day. */
  | "venue-closed"
  | "staff-off"
  | "holiday"
  | "vacation"
  | "no-service-duration"
  /** The party is bigger than the table asked for, or than any table. */
  | "party-too-large";

/**
 * A span given as two clock times, allowing for one that crosses
 * midnight: "20:00"–"02:00" is 20:00 to 26:00 on the day it starts.
 * The grid runs on minutes from the day's midnight, past 24:00 when the
 * business does (lib/bookings/time.ts, minutesToTime).
 */
export function spanMinutes(startTime: string, endTime: string): Interval {
  const start = timeToMinutes(startTime);
  let end = timeToMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

export interface AvailabilityResult {
  slots: string[];
  /** Why the day is empty, when it is empty for a whole-day reason. */
  reason: UnavailableReason | null;
  /** The window the slots were cut from, for the owner-facing calendar. */
  window: Interval | null;
}

/* ─── Helpers ────────────────────────────────────────────── */

/** Does a dated block cover this date? Both ends inclusive. */
function datedBlockCovers(block: BlockRule, date: string): boolean {
  if (!block.startsOn) return false;
  const end = block.endsOn ?? block.startsOn;
  return date >= block.startsOn && date <= end;
}

/**
 * Turns a block into the minutes it removes from this day, or null when
 * it does not apply. An all-day block covers the whole clock.
 */
function blockInterval(block: BlockRule): Interval {
  // An all-day block covers the whole business day, however late it runs.
  if (!block.startTime || !block.endTime) return { start: 0, end: 48 * 60 };
  return spanMinutes(block.startTime, block.endTime);
}

/** Blocks that apply to this date, this staff member and this branch. */
function applicableBlocks(input: AvailabilityInput): BlockRule[] {
  return input.blocks.filter((b) => {
    // A block for another person never affects this request. A block
    // with no person set is the whole business and always does.
    if (b.staffMemberId && b.staffMemberId !== input.staffMemberId) return false;
    if (b.branchId && b.branchId !== input.branchId) return false;

    if (b.dayOfWeek !== null) return b.dayOfWeek === input.dayOfWeek;
    if (b.startsOn) return datedBlockCovers(b, input.date);
    // Neither weekly nor dated: malformed, ignored rather than treated
    // as blocking every day forever.
    return false;
  });
}

/** Subtracts a set of intervals from one, returning what is left. */
export function subtractIntervals(base: Interval, cuts: Interval[]): Interval[] {
  let pieces: Interval[] = [base];

  for (const cut of cuts) {
    const next: Interval[] = [];
    for (const piece of pieces) {
      if (!overlaps(piece.start, piece.end, cut.start, cut.end)) {
        next.push(piece);
        continue;
      }
      if (cut.start > piece.start) next.push({ start: piece.start, end: cut.start });
      if (cut.end < piece.end) next.push({ start: cut.end, end: piece.end });
    }
    pieces = next;
  }

  return pieces.filter((p) => p.end > p.start);
}

/* ─── The engine ─────────────────────────────────────────── */

/**
 * The hours one weekday can be booked in, before blocks and bookings:
 * the business's opening hours, narrowed by one person's own when a
 * person is asked for. Exported so the public profile's weekly hours for
 * a staff member are this, not a copy of it.
 */
export function dayWindow(
  businessHours: DayHoursRule[],
  dayOfWeek: number,
  staff: { workingDays: number[]; hours: StaffDayRule[] } | null,
): { window: Interval } | { reason: "business-closed" | "staff-off" } {
  // ── 1. Business hours ────────────────────────────────────
  const businessRule = businessHours.find((h) => h.dayOfWeek === dayOfWeek);
  if (!businessRule || businessRule.isClosed) return { reason: "business-closed" };

  // A business trading past midnight ("20:00"–"02:00") closes on the
  // next calendar day. The grid keeps counting past 24:00 on the day it
  // opened, so the 01:00 table is Thursday night's, listed under
  // Thursday, and never collides with Friday morning's arithmetic.
  let window: Interval = spanMinutes(businessRule.openTime, businessRule.closeTime);

  // ── 2. Staff hours, narrowing the window further ─────────
  if (staff) {
    if (staff.workingDays.length > 0 && !staff.workingDays.includes(dayOfWeek)) {
      return { reason: "staff-off" };
    }

    const staffRule = staff.hours.find((h) => h.dayOfWeek === dayOfWeek);
    if (staffRule) {
      if (staffRule.isOff) return { reason: "staff-off" };
      // The intersection: a member cannot be seen before the doors open
      // or after they close, whatever their own hours say. A shift that
      // crosses midnight is read the same way as the opening hours.
      const own = spanMinutes(staffRule.startTime, staffRule.endTime);
      window = {
        start: Math.max(window.start, own.start),
        end: Math.min(window.end, own.end),
      };
      if (window.end <= window.start) return { reason: "staff-off" };
    }
    // No row at all: the member follows business hours, which is what
    // every existing staff record does.
  }

  return { window };
}

export function computeAvailability(input: AvailabilityInput): AvailabilityResult {
  const empty = (reason: UnavailableReason): AvailabilityResult => ({
    slots: [],
    reason,
    window: null,
  });

  if (input.serviceDuration <= 0) return empty("no-service-duration");

  // ── 1–2. Business hours, narrowed by the person's own ────
  //
  // Read before the calendar gates because of one case below: a day
  // whose hours run past midnight is still open after its own date has
  // ended.
  const day = dayWindow(
    input.businessHours,
    input.dayOfWeek,
    input.staffMemberId ? { workingDays: input.staffWorkingDays, hours: input.staffHours } : null,
  );

  // ── 10–12. Policy gates on the day as a whole ────────────
  //
  // "Yesterday" is not past while its night is still running: at 00:20
  // on Friday a lounge open Thursday 20:00–02:00 still has its 01:00
  // table, stored under Thursday as "25:00". Minutes are then counted
  // from Thursday's midnight, so "now" is 24:20.
  const nightStillOpen =
    input.daysFromToday === -1 &&
    !("reason" in day) &&
    day.window.end > 24 * 60 &&
    input.nowMinutes + 24 * 60 < day.window.end;
  if (input.daysFromToday < 0 && !nightStillOpen) return empty("past");
  if (input.daysFromToday > input.policy.maxAdvanceDays) return empty("too-far-ahead");

  if (
    input.daysFromToday === 0 &&
    input.policy.sameDayCutoff &&
    input.nowMinutes >= timeToMinutes(input.policy.sameDayCutoff)
  ) {
    return empty("same-day-cutoff");
  }

  if ("reason" in day) return empty(day.reason);
  const window = day.window;

  // ── 3–6. Blocks ──────────────────────────────────────────
  const blocks = applicableBlocks(input);

  // An all-day block gets its own reason, so the UI can say why.
  for (const b of blocks) {
    if (b.startTime && b.endTime) continue;
    if (b.kind === "HOLIDAY") return empty("holiday");
    if (b.kind === "VACATION") return empty("vacation");
    if (b.kind === "CLOSURE") return empty("business-closed");
    // An all-day BREAK is a closure in all but name.
    return empty("business-closed");
  }

  const openPieces = subtractIntervals(window, blocks.map(blockInterval));

  // ── 7–9. Fit the service, with buffers, around bookings ──
  const { bufferMinutes } = input.policy;
  const duration = input.serviceDuration;

  // A booking against a named person or resource only blocks others
  // against that same one, so several chairs or rooms run in parallel;
  // a booking against neither blocks the whole business, which is how a
  // one-room clinic behaves.
  //
  // A resource is held by one booking at a time whoever runs it: two
  // doctors cannot both have room 1 at ten. That check comes first, so
  // a request naming a person still collides on the room.
  //
  // Bookings with nobody assigned, at a business that has staff, are
  // not this function's to place. computeStaffedAvailability counts
  // them against the team as a whole.
  const relevant = input.bookings.filter((b) => {
    if (input.resourceId && b.resourceId === input.resourceId) return true;
    if (input.staffMemberId || b.staffMemberId) {
      return b.staffMemberId === input.staffMemberId;
    }
    if (input.resourceId || b.resourceId) {
      return b.resourceId === input.resourceId;
    }
    return true;
  });

  // Each booking holds its own time plus the buffer after it.
  const busy: Interval[] = relevant.map((b) => ({
    start: b.startMin,
    end: b.endMin + bufferMinutes,
  }));

  const nowOnThisDay =
    input.daysFromToday === 0 ? input.nowMinutes : nightStillOpen ? input.nowMinutes + 24 * 60 : null;
  const earliest = nowOnThisDay === null ? -Infinity : nowOnThisDay + input.policy.minNoticeMinutes;

  const slots: string[] = [];
  for (const piece of openPieces) {
    // Step by the service duration, which is how this grid has always
    // been laid out — changing it would move every existing slot time.
    for (let start = piece.start; start + duration <= piece.end; start += duration) {
      if (start < earliest) continue;

      // The appointment, and the gap it must leave behind it.
      const heldEnd = start + duration + bufferMinutes;
      if (busy.some((b) => overlaps(start, heldEnd, b.start, b.end))) continue;

      slots.push(minutesToTime(start));
    }
  }

  return { slots, reason: slots.length === 0 ? null : null, window };
}

/* ─── A team, rather than one person ─────────────────────── */

/** Someone who can be booked for the service being asked about. */
export interface StaffCandidate {
  id: string;
  workingDays: number[];
  hours: StaffDayRule[];
}

export interface StaffedAvailabilityResult extends AvailabilityResult {
  /**
   * Who takes each slot. For "anyone", the free member with the fewest
   * bookings that day (the first of them in the order given, on a tie);
   * for a named member, that member.
   */
  assignments: Record<string, string>;
}

/**
 * Availability at a business whose service is done by staff.
 *
 * "Any available" used to run the engine with nobody in particular,
 * which only collided with other bookings that also had nobody — so a
 * shop with one barber booked at 14:00 still offered 14:00 to the next
 * customer who did not pick a name, and both arrived for one chair. A
 * time is now offered to "anyone" only when somebody is actually free,
 * and the booking is given to that person.
 *
 * Bookings with nobody assigned (made before this, or by hand) still
 * need a person. Which one is unknown, so each is counted against the
 * team: a time is free for one more booking when more members are free
 * than there are unassigned bookings overlapping it.
 */
export function computeStaffedAvailability(
  base: Omit<AvailabilityInput, "staffMemberId" | "staffHours" | "staffWorkingDays">,
  candidates: StaffCandidate[],
  chosen: string | null,
): StaffedAvailabilityResult {
  const perStaff = candidates.map((c) => ({
    id: c.id,
    result: computeAvailability({
      ...base,
      staffMemberId: c.id,
      staffHours: c.hours,
      staffWorkingDays: c.workingDays,
    }),
  }));

  const own = chosen ? perStaff.find((p) => p.id === chosen) : undefined;
  if (chosen && !own) {
    // Not someone who does this service here.
    return { slots: [], reason: "staff-off", window: null, assignments: {} };
  }

  const { bufferMinutes } = base.policy;
  const unassigned = base.bookings.filter((b) => !b.staffMemberId);
  const freeSets = perStaff.map((p) => ({ id: p.id, free: new Set(p.result.slots) }));
  // So "anyone" spreads across the team rather than filling the
  // longest-serving member's day before anyone else's.
  const load = new Map<string, number>();
  for (const b of base.bookings) {
    if (b.staffMemberId) load.set(b.staffMemberId, (load.get(b.staffMemberId) ?? 0) + 1);
  }

  const candidatesTimes = own
    ? own.result.slots
    : [...new Set(perStaff.flatMap((p) => p.result.slots))].sort(
        (a, b) => timeToMinutes(a) - timeToMinutes(b),
      );

  const slots: string[] = [];
  const assignments: Record<string, string> = {};
  for (const time of candidatesTimes) {
    const start = timeToMinutes(time);
    const heldEnd = start + base.serviceDuration + bufferMinutes;
    const owed = unassigned.filter((b) =>
      overlaps(start, heldEnd, b.startMin, b.endMin + bufferMinutes),
    ).length;
    const free = freeSets.filter((s) => s.free.has(time)).map((s) => s.id);

    if (chosen) {
      // The named member, and enough of the others left over for the
      // bookings nobody has been given yet.
      if (free.length - 1 < owed) continue;
      slots.push(time);
      assignments[time] = chosen;
    } else {
      if (free.length <= owed) continue;
      slots.push(time);
      assignments[time] = free.reduce((best, id) =>
        (load.get(id) ?? 0) < (load.get(best) ?? 0) ? id : best,
      );
    }
  }

  let reason: UnavailableReason | null = null;
  let window: Interval | null = null;
  if (own) {
    reason = slots.length === 0 ? own.result.reason : null;
    window = own.result.window;
  } else {
    const reasons = new Set(perStaff.map((p) => p.result.reason));
    if (slots.length === 0 && reasons.size === 1) reason = [...reasons][0];
    const windows = perStaff.map((p) => p.result.window).filter((w): w is Interval => w !== null);
    if (windows.length > 0) {
      window = {
        start: Math.min(...windows.map((w) => w.start)),
        end: Math.max(...windows.map((w) => w.end)),
      };
    }
  }

  return { slots, reason, window, assignments };
}

/**
 * Is one specific time bookable?
 *
 * The create endpoint asks this rather than re-deriving the grid, so a
 * slot the client offers is validated against the identical rules that
 * produced it. A client that invents a time gets the same answer as one
 * replaying a slot that has since been taken.
 */
export function isSlotAvailable(input: AvailabilityInput, startTime: string): boolean {
  return computeAvailability(input).slots.includes(startTime);
}
