import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { moveBooking } from "@/lib/bookings/state";
import { ARRIVE_EARLY_MINUTES } from "@/lib/bookings/progress-guard";
import { bookingStart, cairoWallClock } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";
import { siteUrl } from "@/lib/url";
import { CODE_PATTERN, deriveCheckInCode, randomToken, sha256 } from "./crypto";

/**
 * The booking's check-in code — QR type B.
 *
 * The customer shows it; the business's staff scan it to mark the
 * customer arrived. That is all it does: it opens no gate (that is a
 * visitor pass, lib/access/passes.ts, issued through a venue's access
 * provider), it is not the customer's manage link (Booking.accessToken,
 * which can cancel), and it carries no personal data — the QR holds a
 * URL with an opaque 43-character code and nothing else.
 *
 * Whether a code is good is decided at the scan, from the booking as it
 * is now: its status, its time window and the business scanning it. So
 * a cancelled, missed, finished or moved booking's code follows the
 * booking without anything having to be pushed anywhere, and replacing
 * a code (the customer thinks it leaked) makes the old one unknown.
 *
 * Checking in is idempotent: the second scan of a checked-in booking
 * says so, with when, and changes nothing. It goes through the booking
 * state machine (CONFIRMED → ARRIVED), conditional on the status read,
 * so a scan racing a cancellation cannot revive the booking.
 *
 * docs/architecture/QR_CREDENTIAL_LIFECYCLE.md.
 */

const MIN = 60_000;
/** How long after the appointment's end the code still checks in a latecomer. */
export const CHECKIN_LATE_MINUTES = 30;
/** Statuses for which the customer is shown a code at all. */
export const CODE_STATUSES = ["CONFIRMED", "ARRIVED", "IN_PROGRESS"] as const;

export type ScanState =
  | "valid"
  | "checked-in"
  | "completed"
  | "too-early"
  | "expired"
  | "cancelled"
  | "not-confirmed"
  | "no-show"
  | "not-found";

interface BookingClock {
  status: string;
  date: Date;
  startTime: string;
  endTime: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

/** The window a code checks in, in the bookings' wall-clock frame (lib/bookings/instants). */
export function checkInWindow(b: BookingClock): { opensAt: Date; closesAt: Date } {
  const start = bookingStart(b);
  const end = b.endsAt ?? (b.endTime ? new Date(b.date.getTime() + timeToMinutes(b.endTime) * MIN) : new Date(start.getTime() + 60 * MIN));
  return {
    opensAt: new Date(start.getTime() - ARRIVE_EARLY_MINUTES * MIN),
    closesAt: new Date(Math.max(end.getTime(), start.getTime()) + CHECKIN_LATE_MINUTES * MIN),
  };
}

/** Pure: what a scan of this booking's code means right now. */
export function scanState(b: BookingClock, now: Date = new Date()): ScanState {
  switch (b.status) {
    case "ARRIVED":
    case "IN_PROGRESS":
      return "checked-in";
    case "COMPLETED":
      return "completed";
    case "CANCELLED":
    case "FAILED_PAYMENT":
      return "cancelled";
    case "NO_SHOW":
      return "no-show";
    case "PENDING":
    case "PENDING_PAYMENT":
      return "not-confirmed";
  }
  if (b.status !== "CONFIRMED") return "not-found";
  const wall = cairoWallClock(now);
  const { opensAt, closesAt } = checkInWindow(b);
  if (wall < opensAt) return "too-early";
  if (wall > closesAt) return "expired";
  return "valid";
}

/** "HH:MM" of a wall-clock-frame instant. */
export function wallTime(d: Date): string {
  return d.toISOString().slice(11, 16);
}

export function checkInUrl(code: string): string {
  return siteUrl(`/c/${code}`);
}

/** The code inside whatever the scanner read: a bare code, or our /c/<code> URL. */
export function extractCode(scanned: string): string | null {
  const s = scanned.trim();
  if (CODE_PATTERN.test(s)) return s;
  const m = /\/c\/([A-Za-z0-9_-]{43})(?:[/?#]|$)/.exec(s);
  return m ? m[1] : null;
}

type Tx = Prisma.TransactionClient;

/**
 * The customer's current code for this booking, issuing one the first
 * time. Null while the booking is not one that checks in (pending,
 * cancelled…) or when no key is configured. If the server key changed
 * since the code was issued, the stored hash is brought up to date, so
 * the code shown is always the code that scans.
 */
export async function currentCheckInCode(bookingId: string): Promise<{ code: string; generation: number } | null> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true, isTest: true } });
  if (!booking || !(CODE_STATUSES as readonly string[]).includes(booking.status)) return null;

  let row = await db.bookingCheckIn.findUnique({ where: { bookingId } });
  if (!row) {
    const nonce = randomToken(24);
    const code = deriveCheckInCode(bookingId, nonce);
    if (!code) return null;
    // Two first views racing: the unique bookingId keeps one; the other
    // reads it back.
    row = await db.bookingCheckIn
      .create({ data: { bookingId, nonce, tokenHash: sha256(code) } })
      .catch(() => db.bookingCheckIn.findUnique({ where: { bookingId } }));
    if (!row) return null;
  }
  if (row.status !== "ACTIVE") return null;
  const code = deriveCheckInCode(bookingId, row.nonce);
  if (!code) return null;
  const hash = sha256(code);
  if (hash !== row.tokenHash) {
    await db.bookingCheckIn.updateMany({ where: { id: row.id, nonce: row.nonce }, data: { tokenHash: hash } });
  }
  return { code, generation: row.generation };
}

/**
 * A new code for the booking; the old one stops scanning at once. For a
 * customer who thinks their code was seen by somebody else.
 */
export async function replaceCheckInCode(bookingId: string): Promise<{ code: string; generation: number } | null> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { status: true } });
  if (!booking || booking.status !== "CONFIRMED") return null;
  const nonce = randomToken(24);
  const code = deriveCheckInCode(bookingId, nonce);
  if (!code) return null;
  const row = await db.bookingCheckIn.upsert({
    where: { bookingId },
    create: { bookingId, nonce, tokenHash: sha256(code) },
    update: { nonce, tokenHash: sha256(code), status: "ACTIVE", generation: { increment: 1 }, revokedAt: null, revokedReason: null },
  });
  return { code, generation: row.generation };
}

/** Withdraws the booking's code (it is cancelled, or otherwise over). */
export async function revokeCheckInCode(tx: Tx, bookingId: string, reason: string): Promise<void> {
  await tx.bookingCheckIn.updateMany({
    where: { bookingId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: new Date(), revokedReason: reason.slice(0, 200) },
  });
}

/** What staff see about a scanned booking: enough to recognise it, nothing more. */
export interface ScanResult {
  state: ScanState;
  booking?: {
    id: string;
    reference: string | null;
    customerName: string;
    serviceName: string;
    staffName: string | null;
    date: string;
    startTime: string;
    endTime: string | null;
    partySize: number | null;
    status: string;
  };
  opensAt?: string;
  checkedInAt?: string | null;
}

/**
 * Looks a scanned code up within what this caller may see. `scope` is
 * lib/business-access bookingScope(): another business's code — or, for
 * a provider, a colleague's booking — is "not-found", exactly like a
 * code that never existed, so a scan never confirms anything outside
 * the caller's own diary.
 */
export async function lookupScan(
  scanned: string,
  scope: Prisma.BookingWhereInput,
  now: Date = new Date(),
): Promise<ScanResult & { checkInId?: string }> {
  const code = extractCode(scanned);
  if (!code) return { state: "not-found" };
  const row = await db.bookingCheckIn.findUnique({
    where: { tokenHash: sha256(code) },
    select: {
      id: true,
      status: true,
      checkedInAt: true,
      booking: {
        select: {
          id: true, reference: true, status: true, date: true, startTime: true, endTime: true, startsAt: true, endsAt: true,
          customerName: true, partySize: true, businessId: true, branchId: true, staffMemberId: true,
          service: { select: { nameAr: true } },
          staffMember: { select: { nameAr: true } },
        },
      },
    },
  });
  // A code withdrawn because its booking is over still says why (cancelled,
  // no-show, completed); scanState never lets it check in. A replaced code
  // is simply unknown — its hash is gone.
  if (!row) return { state: "not-found" };
  const inScope = await db.booking.count({ where: { AND: [{ id: row.booking.id }, scope] } });
  if (!inScope) return { state: "not-found" };

  await db.bookingCheckIn.update({ where: { id: row.id }, data: { scanCount: { increment: 1 }, lastScanAt: now } });

  const b = row.booking;
  const state = scanState(b, now);
  return {
    state,
    checkInId: row.id,
    booking: {
      id: b.id,
      reference: b.reference,
      customerName: b.customerName,
      serviceName: b.service.nameAr,
      staffName: b.staffMember?.nameAr ?? null,
      date: b.date.toISOString().slice(0, 10),
      startTime: b.startTime,
      endTime: b.endTime,
      partySize: b.partySize,
      status: b.status,
    },
    opensAt: state === "too-early" ? wallTime(checkInWindow(b).opensAt) : undefined,
    checkedInAt: row.checkedInAt?.toISOString() ?? null,
  };
}

/**
 * Checks the scanned booking in. Idempotent: a booking already checked
 * in (or further along) answers "checked-in" and is left alone.
 */
export async function checkIn(
  scanned: string,
  scope: Prisma.BookingWhereInput,
  actorUserId: string,
  now: Date = new Date(),
): Promise<ScanResult> {
  const found = await lookupScan(scanned, scope, now);
  if (found.state !== "valid" || !found.booking || !found.checkInId) {
    return withoutId(found);
  }
  const bookingId = found.booking.id;
  const checkInId = found.checkInId;
  const moved = await db.$transaction(async (tx) => {
    const move = await moveBooking({ bookingId, from: "CONFIRMED", to: "ARRIVED", by: "business", actorUserId }, tx);
    if (!move.moved) return false;
    await tx.bookingCheckIn.update({ where: { id: checkInId }, data: { checkedInAt: now, checkedInById: actorUserId } });
    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: "booking.check_in",
        resourceType: "booking",
        resourceId: bookingId,
        summary: "Customer checked in by scanning the booking QR",
        metadata: { via: "qr" },
      },
    });
    return true;
  });
  if (!moved) {
    // Somebody else moved it first — a colleague's scan, a cancellation.
    // Say what it is now rather than guessing.
    return withoutId(await lookupScan(scanned, scope, now));
  }
  log.info("[check-in] checked in", { bookingId });
  return { ...withoutId(found), state: "checked-in", checkedInAt: now.toISOString(), booking: { ...found.booking, status: "ARRIVED" } };
}

/** The scan result as the caller sees it (the internal row id stays here). */
export function withoutId(r: ScanResult & { checkInId?: string }): ScanResult {
  return { state: r.state, booking: r.booking, opensAt: r.opensAt, checkedInAt: r.checkedInAt };
}
