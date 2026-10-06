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
  | "staff-off"
  | "holiday"
  | "vacation"
  | "no-service-duration";

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
  if (!block.startTime || !block.endTime) return { start: 0, end: 24 * 60 };
  return { start: timeToMinutes(block.startTime), end: timeToMinutes(block.endTime) };
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

export function computeAvailability(input: AvailabilityInput): AvailabilityResult {
  const empty = (reason: UnavailableReason): AvailabilityResult => ({
    slots: [],
    reason,
    window: null,
  });

  if (input.serviceDuration <= 0) return empty("no-service-duration");

  // ── 10–12. Policy gates on the day as a whole ────────────
  if (input.daysFromToday < 0) return empty("past");
  if (input.daysFromToday > input.policy.maxAdvanceDays) return empty("too-far-ahead");

  if (
    input.daysFromToday === 0 &&
    input.policy.sameDayCutoff &&
    input.nowMinutes >= timeToMinutes(input.policy.sameDayCutoff)
  ) {
    return empty("same-day-cutoff");
  }

  // ── 1. Business hours ────────────────────────────────────
  const businessRule = input.businessHours.find((h) => h.dayOfWeek === input.dayOfWeek);
  if (!businessRule || businessRule.isClosed) return empty("business-closed");

  let window: Interval = {
    start: timeToMinutes(businessRule.openTime),
    end: timeToMinutes(businessRule.closeTime),
  };
  // A business trading past midnight closes the next day; the grid works
  // within one day, so the window stops at the end of this one.
  if (window.end <= window.start) window = { start: window.start, end: 24 * 60 };

  // ── 2. Staff hours, narrowing the window further ─────────
  if (input.staffMemberId) {
    if (input.staffWorkingDays.length > 0 && !input.staffWorkingDays.includes(input.dayOfWeek)) {
      return empty("staff-off");
    }

    const staffRule = input.staffHours.find((h) => h.dayOfWeek === input.dayOfWeek);
    if (staffRule) {
      if (staffRule.isOff) return empty("staff-off");
      // The intersection: a member cannot be seen before the doors open
      // or after they close, whatever their own hours say.
      window = {
        start: Math.max(window.start, timeToMinutes(staffRule.startTime)),
        end: Math.min(window.end, timeToMinutes(staffRule.endTime)),
      };
      if (window.end <= window.start) return empty("staff-off");
    }
    // No row at all: the member follows business hours, which is what
    // every existing staff record does.
  }

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

  // Collision is scoped exactly as the database constraint is: a
  // booking against a named person or resource only blocks others
  // against that same one, so several chairs or rooms run in parallel;
  // a booking against neither blocks the whole business, which is how a
  // one-room clinic behaves.
  const relevant = input.bookings.filter((b) => {
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

  const earliest =
    input.daysFromToday === 0 ? input.nowMinutes + input.policy.minNoticeMinutes : -Infinity;

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
