import type { AccessCredential, AccessEntitlement, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { wallToInstant } from "@/lib/bookings/instants";
import { decideAccess, reasonText, type AccessPolicy, type EligibilityDecision } from "./eligibility";
import { openToken, randomToken } from "./crypto";
import { providerUsable } from "./provider";
import { enqueueJob, kickAccessJobs, holderLabel } from "./sync";

/**
 * Visitor passes (QR type C): the lifecycle, kept in step with the booking.
 *
 *   requested ──► entitlement ELIGIBLE ──► credential PENDING_PROVIDER ──► ACTIVE
 *                      │                              │                     │
 *                      │                              └─► FAILED (retry)    ├─► updated (new version)
 *                      ├─► SUSPENDED (anything that can clear: the booking
 *                      │    awaiting re-confirmation, a venue notice,
 *                      │    security, the business paused) ──────────────────┤
 *                      ├─► REVOKED (booking cancelled, guest removed…) ─────┼─► REVOKE_PENDING ─► REVOKED
 *                      └─► EXPIRED (window passed, no-show cut-off) ────────┴─► EXPIRED
 *
 * A pass exists only for someone who asked for one: the booking holder
 * (requestPass) and the named guests they add (addGuest), each with an
 * invitation link of their own. A confirmed booking alone issues nothing.
 *
 * syncBookingAccess() is the one place that moves any of it. It re-reads
 * the booking, the business, the venue listing, the venue's policy and
 * notices, decides each person's right afresh (lib/access/eligibility),
 * and brings the entitlement and its credential into line — queuing the
 * provider calls (lib/access/sync) in the same transaction. Every path
 * that changes a booking calls it (lib/access/hooks.ts), and the cron
 * re-runs it for live passes in a bounded round-robin. Changes with no
 * booking of their own are pushed too: a venue's (venueAccessChanged) and
 * a business's status (accessAfterBusinessChange), each for up to 200
 * bookings at once; whatever they do not reach, the cron does, at 50
 * bookings a run.
 *
 * Terminal states stay terminal: a REVOKED or EXPIRED entitlement never
 * becomes ELIGIBLE again (a reinstated security suspension is SUSPENDED,
 * not REVOKED, for exactly that reason).
 */

type Tx = Prisma.TransactionClient;
const LIVE: AccessCredential["status"][] = ["PENDING_PROVIDER", "ACTIVE", "REVOKE_PENDING"];
/** Ineligibility that ends a pass for good; every other reason only holds it. */
export const FINAL_REASONS = new Set(["booking-cancelled", "booking-no_show", "booking-failed_payment", "guest-removed", "test-booking"]);
/**
 * How many unhealthy ends one pass may go through before a person must
 * look: issues that FAILED, and passes withdrawn because the provider
 * misbehaved (a lost update, an unconfirmed pass — they carry lastError).
 * Passes withdrawn and re-issued because the booking or the venue
 * changed do not count: those are not failures.
 */
export const MAX_CREDENTIALS_PER_ENTITLEMENT = 5;
export const failedCount = (credentials: { status: string; lastError?: string | null }[]) =>
  credentials.filter((c) => c.status === "FAILED" || !!c.lastError).length;

/**
 * Serialises access work on one booking: every path that may issue or
 * withdraw a pass takes this transaction-scoped lock first, so two of
 * them racing (a cron sync and a booking confirmation, two taps on
 * "retry") cannot both issue — the second waits, then sees the first's
 * credential. Released at commit or rollback.
 */
async function lockBooking(tx: Tx, bookingId: string): Promise<void> {
  // Never wait long: a lock timeout is an ordinary error the caller can
  // handle, where an endless wait would run into the transaction's own
  // timeout and close it.
  await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`access:${bookingId}`}, 0))`;
  await tx.$executeRaw`SET LOCAL lock_timeout = DEFAULT`;
}

/** A wall-clock-frame instant (lib/bookings/instants) as the real instant. */
export function wallFrameToInstant(d: Date): Date {
  const iso = d.toISOString();
  return wallToInstant(iso.slice(0, 10), d.getUTCHours() * 60 + d.getUTCMinutes());
}

interface VenueContext {
  venue: {
    id: string;
    nameAr: string;
    nameEn: string | null;
    status: string;
    accessEnabled: boolean;
    accessProvider: { id: string; kind: "SANDBOX" | "PARTNER"; slug: string; isEnabled: boolean } | null;
  };
  policy: (AccessPolicy & { accessInstructionsAr: string | null; accessInstructionsEn: string | null; escalationContact: string | null }) | null;
  gates: { id: string; nameAr: string; nameEn: string | null }[];
  listings: { branchId: string | null }[];
  activeBranchCount: number;
  accessSuspended: boolean;
}

/**
 * The venue a booking's visitor passes would be for: one where the
 * business (or the booking's branch) is APPROVED — preferring one with
 * passes switched on. Null when the business is in no venue at all.
 */
export async function venueContext(
  tx: Tx | typeof db,
  booking: { businessId: string; branchId: string | null; date: Date },
): Promise<VenueContext | null> {
  // Flat, one query at a time: inside a transaction Prisma would otherwise
  // load sibling relations in parallel on the transaction's one connection.
  const memberships = await tx.venueMembership.findMany({
    where: { businessId: booking.businessId, status: "APPROVED" },
    select: { branchId: true, venueId: true },
  });
  if (!memberships.length) return null;
  const venues = await tx.venue.findMany({
    where: { id: { in: [...new Set(memberships.map((m) => m.venueId))] } },
    // Stable, so a business listed in two venues keeps the same one run to run.
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, nameAr: true, nameEn: true, status: true, accessEnabled: true, accessProviderId: true },
  });
  const activeBranchCount = await tx.branch.count({ where: { businessId: booking.businessId, isActive: true } });
  const listingsOf = (venueId: string) => memberships.filter((m) => m.venueId === venueId);
  const covers = (venueId: string) =>
    listingsOf(venueId).some(
      (l) => l.branchId === null || (booking.branchId !== null && l.branchId === booking.branchId) || (booking.branchId === null && activeBranchCount <= 1),
    );
  const candidates = venues.filter((v) => covers(v.id));
  const v = candidates.find((x) => x.accessEnabled) ?? candidates[0] ?? venues[0];
  if (!v) return null;

  const accessProvider = v.accessProviderId
    ? await tx.accessProvider.findUnique({ where: { id: v.accessProviderId }, select: { id: true, kind: true, slug: true, isEnabled: true } })
    : null;
  const policy = await tx.venuePolicy.findUnique({ where: { venueId: v.id } });
  const gates = await tx.venueGate.findMany({ where: { venueId: v.id, isActive: true }, select: { id: true, nameAr: true, nameEn: true } });
  const notice = await tx.venueException.findFirst({
    where: { venueId: v.id, kind: { in: ["ACCESS_SUSPENDED", "CLOSED"] }, startsOn: { lte: booking.date }, endsOn: { gte: booking.date } },
    select: { id: true },
  });
  return {
    venue: { id: v.id, nameAr: v.nameAr, nameEn: v.nameEn, status: v.status, accessEnabled: v.accessEnabled, accessProvider },
    policy: policy
      ? {
          visitorEligibility: policy.visitorEligibility,
          accessBeforeMinutes: policy.accessBeforeMinutes,
          accessAfterMinutes: policy.accessAfterMinutes,
          maxGuestsPerBooking: policy.maxGuestsPerBooking,
          reentryAllowed: policy.reentryAllowed,
          allowedGateIds: policy.allowedGateIds,
          identityRequirement: policy.identityRequirement,
          lateEntryCutoffMinutes: policy.lateEntryCutoffMinutes,
          noShowRevokeMinutes: policy.noShowRevokeMinutes,
          accessInstructionsAr: policy.accessInstructionsAr,
          accessInstructionsEn: policy.accessInstructionsEn,
          escalationContact: policy.escalationContact,
        }
      : null,
    gates,
    listings: listingsOf(v.id).map((m) => ({ branchId: m.branchId })),
    activeBranchCount,
    accessSuspended: !!notice,
  };
}

const bookingSelect = {
  id: true, status: true, isTest: true, startsAt: true, endsAt: true, date: true, branchId: true, businessId: true,
  business: { select: { status: true } },
} as const;
type BookingRow = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

function decide(
  booking: BookingRow,
  ctx: VenueContext | null,
  visitor: { role: "HOLDER" | "GUEST"; displayName: string; phoneE164: string | null; removed: boolean },
  guestIndex: number,
  arrived: boolean,
  now: Date,
): EligibilityDecision {
  if (!ctx) return { status: "INELIGIBLE", reason: "business-not-listed-in-venue" };
  return decideAccess({
    booking: {
      status: booking.status,
      isTest: booking.isTest,
      startsAt: booking.startsAt ? wallFrameToInstant(booking.startsAt) : null,
      endsAt: booking.endsAt ? wallFrameToInstant(booking.endsAt) : null,
      branchId: booking.branchId,
    },
    business: { status: booking.business.status },
    listings: ctx.listings,
    activeBranchCount: ctx.activeBranchCount,
    venue: { status: ctx.venue.status, accessEnabled: ctx.venue.accessEnabled, providerUsable: providerUsable(ctx.venue.accessProvider) },
    policy: ctx.policy,
    visitor,
    guestIndex,
    accessSuspended: ctx.accessSuspended,
    arrived,
    now,
  });
}

function sameDate(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}
function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * Brings every pass on a booking into line with how things are now.
 * Returns whether any provider call was queued (the caller kicks the
 * job runner after its transaction commits).
 */
export async function syncBookingAccess(bookingId: string, opts: { tx?: Tx; now?: Date; kick?: boolean } = {}): Promise<{ queued: boolean }> {
  const run = async (tx: Tx) => {
    await lockBooking(tx, bookingId);
    const guests = await loadGuests(tx, bookingId);
    if (!guests.length) return { queued: false };
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, select: bookingSelect });
    if (!booking) return { queued: false };
    const now = opts.now ?? new Date();
    const ctx = await venueContext(tx, booking);
    const entitlementIds = guests.map((g) => g.entitlement?.id).filter((x): x is string => !!x);
    const entered = entitlementIds.length
      ? await tx.accessEvent.count({ where: { entitlementId: { in: entitlementIds }, kind: "ENTRY_GRANTED" } })
      : 0;
    const arrived = entered > 0 || booking.status === "ARRIVED" || booking.status === "IN_PROGRESS";

    let queued = false;
    let guestIndex = 0;
    for (const g of guests) {
      const live = !g.removedAt;
      const index = g.role === "GUEST" && live ? guestIndex++ : 0;
      const decision = decide(booking, ctx, { role: g.role, displayName: g.visitor.displayName, phoneE164: g.visitor.phoneE164, removed: !live }, index, arrived, now);
      queued = (await reconcile(tx, booking, g, decision, ctx, now)) || queued;
    }
    return { queued };
  };
  const result = opts.tx ? await run(opts.tx) : await db.$transaction(run);
  if (result.queued && !opts.tx && opts.kick !== false) kickAccessJobs();
  return result;
}

type GuestRow = Prisma.BookingGuestGetPayload<{
  include: { visitor: true; entitlement: { include: { credentials: true } } };
}>;

/** A booking's guests with their visitor, entitlement and credentials — flat queries, in order. */
async function loadGuests(tx: Tx, bookingId: string): Promise<GuestRow[]> {
  const guests = await tx.bookingGuest.findMany({ where: { bookingId }, orderBy: { createdAt: "asc" } });
  if (!guests.length) return [];
  const visitors = await tx.visitor.findMany({ where: { id: { in: guests.map((g) => g.visitorId) } } });
  const ents = await tx.accessEntitlement.findMany({ where: { bookingGuestId: { in: guests.map((g) => g.id) } } });
  const creds = ents.length
    ? await tx.accessCredential.findMany({ where: { entitlementId: { in: ents.map((e) => e.id) } }, orderBy: { createdAt: "desc" } })
    : [];
  return guests.map((g) => {
    const ent = ents.find((e) => e.bookingGuestId === g.id);
    return {
      ...g,
      visitor: visitors.find((v) => v.id === g.visitorId)!,
      entitlement: ent ? { ...ent, credentials: creds.filter((c) => c.entitlementId === ent.id) } : null,
    };
  });
}

async function reconcile(
  tx: Tx,
  booking: BookingRow,
  g: GuestRow,
  decision: EligibilityDecision,
  ctx: VenueContext | null,
  now: Date,
): Promise<boolean> {
  let ent: (AccessEntitlement & { credentials: AccessCredential[] }) | null = g.entitlement;
  const granted = decision.status === "ELIGIBLE" || decision.status === "SUSPENDED";

  if (!ent) {
    if (!granted || !ctx) return false;
    ent = await tx.accessEntitlement.create({
      data: {
        bookingGuestId: g.id, bookingId: booking.id, venueId: ctx.venue.id, visitorId: g.visitorId,
        status: decision.status, reason: decision.reason,
        validFrom: decision.validFrom, validUntil: decision.validUntil, entryUntil: decision.entryUntil,
        allowedGateIds: decision.allowedGateIds, reentryAllowed: decision.reentryAllowed,
      },
      include: { credentials: true },
    });
  } else if ((ent.status === "ELIGIBLE" || ent.status === "SUSPENDED") && ent.validUntil <= now && !(granted && decision.validUntil > now)) {
    // Whatever else is true, a window that has passed is over — unless the
    // booking has since moved to a time still to come (a late reschedule).
    ent = await tx.accessEntitlement.update({ where: { id: ent.id }, data: { status: "EXPIRED", reason: "window-passed" }, include: { credentials: true } });
  } else if (ent.status === "ELIGIBLE" || ent.status === "SUSPENDED") {
    const movedVenue = !ctx || ctx.venue.id !== ent.venueId;
    if (!granted || movedVenue) {
      const reason = !granted ? (decision as { reason: string }).reason : "business-not-listed-in-venue";
      // Over for good only when the booking is; anything that can come
      // back (the booking waiting for confirmation after a move, the
      // business paused, the venue switching passes off for a while)
      // holds the pass instead, and it is issued again when it clears.
      const status = decision.status === "EXPIRED" ? "EXPIRED" : FINAL_REASONS.has(reason) ? "REVOKED" : "SUSPENDED";
      // A security hold outlives any temporary reason: only the desk lifts
      // it (securityReinstate), so it is not replaced by one that clears.
      const held = status === "SUSPENDED" && ent.status === "SUSPENDED" && ent.reason === "security-override";
      const nextReason = held ? "security-override" : reason;
      if (status !== ent.status || nextReason !== ent.reason) {
        ent = await tx.accessEntitlement.update({ where: { id: ent.id }, data: { status, reason: nextReason }, include: { credentials: true } });
      }
    } else {
      const d = decision as Extract<EligibilityDecision, { status: "ELIGIBLE" | "SUSPENDED" }>;
      const securityHold = ent.status === "SUSPENDED" && ent.reason === "security-override";
      const status = securityHold ? "SUSPENDED" : d.status;
      const reason = securityHold ? "security-override" : d.reason;
      const changed =
        !sameDate(ent.validFrom, d.validFrom) || !sameDate(ent.validUntil, d.validUntil) || !sameDate(ent.entryUntil, d.entryUntil) ||
        !sameList(ent.allowedGateIds, d.allowedGateIds) || ent.reentryAllowed !== d.reentryAllowed;
      if (changed || status !== ent.status || reason !== ent.reason) {
        ent = await tx.accessEntitlement.update({
          where: { id: ent.id },
          data: {
            status, reason,
            validFrom: d.validFrom, validUntil: d.validUntil, entryUntil: d.entryUntil,
            allowedGateIds: d.allowedGateIds, reentryAllowed: d.reentryAllowed,
            ...(changed ? { version: { increment: 1 } } : {}),
          },
          include: { credentials: true },
        });
      }
    }
  }

  return reconcileCredential(tx, ent, ctx, now);
}

/** Makes the credential match the entitlement. */
async function reconcileCredential(
  tx: Tx,
  ent: AccessEntitlement & { credentials: AccessCredential[] },
  ctx: VenueContext | null,
  now: Date,
): Promise<boolean> {
  const sorted = [...ent.credentials].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const live = sorted.find((c) => LIVE.includes(c.status));
  const latest = sorted[0];

  if (ent.status === "ELIGIBLE") {
    if (live) {
      if (live.status !== "REVOKE_PENDING" && live.version < ent.version) {
        await tx.accessCredential.update({ where: { id: live.id }, data: { version: ent.version } });
        await enqueueJob(tx, live, "UPDATE", ent.version);
        return true;
      }
      return false; // a withdrawal still in progress finishes before a new pass is asked for
    }
    if (latest?.status === "FAILED") return false; // the customer asks again (retryPass)
    if (failedCount(sorted) >= MAX_CREDENTIALS_PER_ENTITLEMENT) return false;
    const provider = ctx?.venue.accessProvider;
    if (!provider || !providerUsable(provider)) return false;
    return issueCredential(tx, ent, provider.id);
  }

  // SUSPENDED, REVOKED or EXPIRED: nothing may stay usable.
  if (live && (live.status === "PENDING_PROVIDER" || live.status === "ACTIVE")) {
    if (ent.status === "EXPIRED" && ent.reason === "window-passed" && live.status === "ACTIVE") {
      // The provider's own validity ended at the same moment; nothing to call.
      await tx.accessCredential.update({ where: { id: live.id }, data: { status: "EXPIRED" } });
      return false;
    }
    await withdraw(tx, live, ent.reason ?? ent.status.toLowerCase(), null, now);
    return true;
  }
  return false;
}

async function issueCredential(tx: Tx, ent: AccessEntitlement, providerId: string): Promise<boolean> {
  const credential = await tx.accessCredential.create({
    data: { entitlementId: ent.id, providerId, correlationId: `acc_${randomToken(12)}`, version: ent.version, expiresAt: ent.validUntil },
  });
  await enqueueJob(tx, credential, "PROVISION", ent.version);
  return true;
}

async function withdraw(tx: Tx, c: AccessCredential, reason: string, byUserId: string | null, now: Date): Promise<void> {
  await tx.accessCredential.update({ where: { id: c.id }, data: { status: "REVOKE_PENDING", revokedAt: now } });
  await tx.accessRevocation.create({ data: { credentialId: c.id, reason: reason.slice(0, 200), requestedById: byUserId } });
  await enqueueJob(tx, c, "REVOKE", c.version);
}

// ─── What the customer does ────────────────────────────────────────────────

export const visitorInputSchemaLimits = { name: 80, phone: 20 } as const;

export type AccessActionResult =
  | { ok: true }
  | { ok: false; code: "not-offered" | "ineligible" | "limit" | "phone-required" | "not-found" | "not-retryable"; reason?: string };

/** The booking holder asks for their own pass. Idempotent. */
export async function requestPass(
  bookingId: string,
  holder: { displayName: string; phoneE164: string | null; userId: string | null },
): Promise<AccessActionResult> {
  const pre = await preflight(bookingId, { role: "HOLDER", displayName: holder.displayName, phoneE164: holder.phoneE164, removed: false }, 0);
  if (!pre.ok) return pre;
  await db.$transaction(async (tx) => {
    const existing = await tx.bookingGuest.findFirst({ where: { bookingId, role: "HOLDER" } });
    if (existing) {
      const before = await tx.visitor.findUnique({ where: { id: existing.visitorId }, select: { displayName: true, phoneE164: true } });
      await tx.visitor.update({ where: { id: existing.visitorId }, data: { displayName: holder.displayName, phoneE164: holder.phoneE164 } });
      // The provider has the old first name or phone: a new version sends
      // it. A change it is never sent (a surname) sends nothing.
      if (before && (holderLabel(before.displayName) !== holderLabel(holder.displayName) || before.phoneE164 !== holder.phoneE164)) {
        await tx.accessEntitlement.updateMany({ where: { bookingGuestId: existing.id }, data: { version: { increment: 1 } } });
      }
      return;
    }
    const visitor = await tx.visitor.create({ data: { displayName: holder.displayName, phoneE164: holder.phoneE164, userId: holder.userId } });
    // The partial unique index keeps one holder even if two requests race.
    await tx.bookingGuest.create({ data: { bookingId, visitorId: visitor.id, role: "HOLDER", inviteToken: randomToken(24) } });
  }).catch((e) => {
    if ((e as { code?: string }).code !== "P2002") throw e;
  });
  await syncBookingAccess(bookingId);
  return { ok: true };
}

/** The holder adds a named guest, within the venue's limit. */
export async function addGuest(bookingId: string, guest: { displayName: string; phoneE164: string | null }): Promise<AccessActionResult & { inviteToken?: string }> {
  const count = await db.bookingGuest.count({ where: { bookingId, role: "GUEST", removedAt: null } });
  const holder = await db.bookingGuest.findFirst({ where: { bookingId, role: "HOLDER" } });
  if (!holder) return { ok: false, code: "not-found", reason: "request-your-own-pass-first" };
  const pre = await preflight(bookingId, { role: "GUEST", displayName: guest.displayName, phoneE164: guest.phoneE164, removed: false }, count);
  if (!pre.ok) return pre;
  const inviteToken = randomToken(24);
  // Counted again inside, under the booking's row lock, so two adds racing
  // cannot both take the last place.
  const added = await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Booking" WHERE "id" = ${bookingId} FOR UPDATE`;
    const now = await tx.bookingGuest.count({ where: { bookingId, role: "GUEST", removedAt: null } });
    if (now !== count) return false;
    const visitor = await tx.visitor.create({ data: { displayName: guest.displayName, phoneE164: guest.phoneE164 } });
    await tx.bookingGuest.create({ data: { bookingId, visitorId: visitor.id, role: "GUEST", inviteToken } });
    return true;
  });
  if (!added) return { ok: false, code: "limit" };
  await syncBookingAccess(bookingId);
  return { ok: true, inviteToken };
}

export async function removeGuest(bookingId: string, guestId: string): Promise<AccessActionResult> {
  const n = await db.bookingGuest.updateMany({ where: { id: guestId, bookingId, role: "GUEST", removedAt: null }, data: { removedAt: new Date() } });
  if (!n.count) return { ok: false, code: "not-found" };
  await syncBookingAccess(bookingId);
  return { ok: true };
}

/** After a failed issue: ask the provider again (bounded per entitlement). */
export async function retryPass(bookingId: string, guestId: string): Promise<AccessActionResult> {
  const g = await db.bookingGuest.findFirst({
    where: { id: guestId, bookingId, removedAt: null },
    include: { entitlement: { include: { credentials: { orderBy: { createdAt: "desc" } } } } },
  });
  const ent = g?.entitlement;
  if (!ent || ent.status !== "ELIGIBLE") return { ok: false, code: "not-retryable" };
  const latest = ent.credentials[0];
  if (!latest || latest.status !== "FAILED") return { ok: false, code: "not-retryable" };
  if (failedCount(ent.credentials) >= MAX_CREDENTIALS_PER_ENTITLEMENT) return { ok: false, code: "limit", reason: "too-many-attempts" };
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: { businessId: true, branchId: true, date: true } });
  const ctx = booking ? await venueContext(db, booking) : null;
  const provider = ctx?.venue.accessProvider;
  if (!provider || !providerUsable(provider)) return { ok: false, code: "not-offered" };
  const issued = await db.$transaction(async (tx) => {
    await lockBooking(tx, bookingId);
    // Decided again under the lock: a concurrent retry may have issued already.
    const live = await tx.accessCredential.count({ where: { entitlementId: ent.id, status: { in: LIVE } } });
    if (live) return false;
    // ...and a cancellation or expiry may have ended the right to one.
    const fresh = await tx.accessEntitlement.findUnique({ where: { id: ent.id } });
    if (!fresh || fresh.status !== "ELIGIBLE") return false;
    return issueCredential(tx, fresh, provider.id);
  });
  if (!issued) return { ok: true };
  kickAccessJobs();
  return { ok: true };
}

async function preflight(
  bookingId: string,
  visitor: { role: "HOLDER" | "GUEST"; displayName: string; phoneE164: string | null; removed: boolean },
  guestIndex: number,
): Promise<AccessActionResult> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: bookingSelect });
  if (!booking) return { ok: false, code: "not-found" };
  const ctx = await venueContext(db, booking);
  if (!ctx || !ctx.venue.accessEnabled) return { ok: false, code: "not-offered" };
  const d = decide(booking, ctx, visitor, guestIndex, false, new Date());
  if (d.status === "ELIGIBLE" || d.status === "SUSPENDED") return { ok: true };
  if (d.reason === "over-guest-limit") return { ok: false, code: "limit", reason: d.reason };
  if (d.reason === "phone-required") return { ok: false, code: "phone-required", reason: d.reason };
  return { ok: false, code: "ineligible", reason: d.reason ?? undefined };
}

// ─── What the customer sees ────────────────────────────────────────────────

export type PassState = "ineligible" | "pending" | "active" | "updating" | "suspended" | "revoked" | "expired" | "failed" | "withdrawing";

export interface PassView {
  guestId: string;
  role: "HOLDER" | "GUEST";
  displayName: string;
  state: PassState;
  reason: string | null;
  validFrom: string | null;
  validUntil: string | null;
  entryUntil: string | null;
  gates: string[];
  reentryAllowed: boolean;
  /** What to present at the gate; only while active. */
  pass: { token: string; format: string; sandbox: boolean } | null;
  canRetry: boolean;
  /** The guest's own link; only in the holder's view. */
  inviteToken?: string;
}

export interface BookingAccessView {
  offered: boolean;
  venue: { id: string; name: string; instructions: string | null } | null;
  sandbox: boolean;
  eligibility: { eligible: boolean; reason: string | null };
  guestLimit: number;
  identityRequirement: "NAME" | "NAME_AND_PHONE";
  holder: PassView | null;
  guests: PassView[];
}

function passState(ent: (AccessEntitlement & { credentials: AccessCredential[] }) | null | undefined): { state: PassState; credential: AccessCredential | null } {
  if (!ent) return { state: "ineligible", credential: null };
  const sorted = [...ent.credentials].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const c = sorted[0] ?? null;
  if (ent.status === "SUSPENDED") return { state: "suspended", credential: c };
  if (ent.status === "REVOKED") return { state: c?.status === "REVOKE_PENDING" ? "withdrawing" : "revoked", credential: c };
  if (ent.status === "EXPIRED") return { state: "expired", credential: c };
  if (!c) return { state: "pending", credential: null };
  switch (c.status) {
    case "PENDING_PROVIDER":
      return { state: "pending", credential: c };
    case "ACTIVE":
      return { state: (c.confirmedVersion ?? 0) < ent.version ? "updating" : "active", credential: c };
    case "FAILED":
      return { state: "failed", credential: c };
    case "REVOKE_PENDING":
      return { state: "withdrawing", credential: c };
    case "EXPIRED":
      return { state: "expired", credential: c };
    default:
      return { state: "pending", credential: c };
  }
}

function toView(
  g: GuestRow & { entitlement: (AccessEntitlement & { credentials: AccessCredential[] }) | null },
  ctx: VenueContext | null,
  en: boolean,
  sandbox: boolean,
  includeInvite: boolean,
  fallbackReason: string | null,
): PassView {
  const ent = g.entitlement;
  const { state, credential } = passState(ent);
  const token = (state === "active" || state === "updating") && credential ? openToken(credential.tokenCiphertext) : null;
  const gateName = (id: string) => {
    const gate = ctx?.gates.find((x) => x.id === id);
    return gate ? (en ? gate.nameEn ?? gate.nameAr : gate.nameAr) : null;
  };
  return {
    guestId: g.id,
    role: g.role,
    displayName: g.visitor.displayName,
    state,
    reason: reasonText(ent?.reason ?? (state === "failed" ? null : fallbackReason), en),
    validFrom: ent?.validFrom.toISOString() ?? null,
    validUntil: ent?.validUntil.toISOString() ?? null,
    entryUntil: ent?.entryUntil?.toISOString() ?? null,
    gates: (ent?.allowedGateIds ?? []).map(gateName).filter((x): x is string => !!x),
    reentryAllowed: ent?.reentryAllowed ?? false,
    pass: token ? { token, format: credential?.displayFormat ?? "QR", sandbox } : null,
    canRetry: state === "failed" && failedCount(ent?.credentials ?? []) < MAX_CREDENTIALS_PER_ENTITLEMENT,
    ...(includeInvite && g.role === "GUEST" ? { inviteToken: g.inviteToken } : {}),
  };
}

/** Everything the booking holder's screen (web or app) shows about visitor access. */
export async function bookingAccessView(bookingId: string, en = false): Promise<BookingAccessView> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, select: bookingSelect });
  const none: BookingAccessView = {
    offered: false, venue: null, sandbox: false, eligibility: { eligible: false, reason: null },
    guestLimit: 0, identityRequirement: "NAME", holder: null, guests: [],
  };
  if (!booking) return none;
  const ctx = await venueContext(db, booking);
  // Not offered at all: nothing is shown, rather than a section saying "no".
  if (!ctx || !ctx.venue.accessEnabled || ctx.policy?.visitorEligibility !== "BOOKING_REQUIRED") return none;
  const guests = await db.bookingGuest.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    include: { visitor: true, entitlement: { include: { credentials: true } } },
  });
  const sandbox = ctx.venue.accessProvider?.kind === "SANDBOX";
  const holderDecision = decide(booking, ctx, { role: "HOLDER", displayName: "x", phoneE164: "x", removed: false }, 0, false, new Date());
  const eligible = holderDecision.status === "ELIGIBLE" || holderDecision.status === "SUSPENDED";
  const reason = holderDecision.reason;
  const holderRow = guests.find((g) => g.role === "HOLDER");
  return {
    offered: true,
    venue: {
      id: ctx.venue.id,
      name: en ? ctx.venue.nameEn ?? ctx.venue.nameAr : ctx.venue.nameAr,
      instructions: (en ? ctx.policy?.accessInstructionsEn ?? ctx.policy?.accessInstructionsAr : ctx.policy?.accessInstructionsAr) ?? null,
    },
    sandbox,
    eligibility: { eligible, reason: reasonText(reason, en) },
    guestLimit: ctx.policy?.maxGuestsPerBooking ?? 0,
    identityRequirement: ctx.policy?.identityRequirement ?? "NAME",
    holder: holderRow ? toView(holderRow, ctx, en, sandbox, false, reason) : null,
    guests: guests.filter((g) => g.role === "GUEST" && !g.removedAt).map((g) => toView(g, ctx, en, sandbox, true, reason)),
  };
}

/** A guest's own view, from their invitation link: their pass, nothing about the booking. */
export async function guestPassView(inviteToken: string, en = false) {
  const g = await db.bookingGuest.findUnique({
    where: { inviteToken },
    include: { visitor: true, entitlement: { include: { credentials: true } }, booking: { select: bookingSelect } },
  });
  if (!g || g.removedAt) return null;
  const ctx = await venueContext(db, g.booking);
  const sandbox = ctx?.venue.accessProvider?.kind === "SANDBOX";
  return {
    venue: ctx ? { name: en ? ctx.venue.nameEn ?? ctx.venue.nameAr : ctx.venue.nameAr, instructions: (en ? ctx.policy?.accessInstructionsEn ?? ctx.policy?.accessInstructionsAr : ctx.policy?.accessInstructionsAr) ?? null } : null,
    sandbox,
    pass: toView(g, ctx, en, sandbox, false, null),
  };
}

// ─── The venue's security desk ────────────────────────────────────────────

export async function securitySuspend(entitlementId: string, venueId: string, actorUserId: string, note: string): Promise<boolean> {
  const done = await db.$transaction(async (tx) => {
    const n = await tx.accessEntitlement.updateMany({
      where: { id: entitlementId, venueId, status: "ELIGIBLE" },
      data: { status: "SUSPENDED", reason: "security-override", overriddenById: actorUserId },
    });
    if (!n.count) return null;
    await tx.accessEvent.create({
      data: { venueId, entitlementId, kind: "OVERRIDE_SUSPEND", occurredAt: new Date(), actorUserId, reason: note.slice(0, 300) },
    });
    const ent = await tx.accessEntitlement.findUnique({ where: { id: entitlementId }, select: { bookingId: true } });
    return ent?.bookingId ?? null;
  });
  if (!done) return false;
  await syncBookingAccess(done);
  return true;
}

export async function securityReinstate(entitlementId: string, venueId: string, actorUserId: string, note: string): Promise<boolean> {
  const done = await db.$transaction(async (tx) => {
    const n = await tx.accessEntitlement.updateMany({
      where: { id: entitlementId, venueId, status: "SUSPENDED", reason: "security-override" },
      data: { status: "ELIGIBLE", reason: null, overriddenById: actorUserId },
    });
    if (!n.count) return null;
    await tx.accessEvent.create({
      data: { venueId, entitlementId, kind: "OVERRIDE_REINSTATE", occurredAt: new Date(), actorUserId, reason: note.slice(0, 300) },
    });
    const ent = await tx.accessEntitlement.findUnique({ where: { id: entitlementId }, select: { bookingId: true } });
    return ent?.bookingId ?? null;
  });
  if (!done) return false;
  // The right is decided again from scratch: a booking cancelled meanwhile stays off.
  await syncBookingAccess(done);
  return true;
}

export async function escalate(entitlementId: string | null, venueId: string, actorUserId: string, note: string): Promise<void> {
  await db.accessEvent.create({
    data: { venueId, entitlementId, kind: "ESCALATION", occurredAt: new Date(), actorUserId, reason: note.slice(0, 300) },
  });
  log.warn("[access] escalation raised", { venueId });
}

/**
 * What a business sees of its booking's visitor passes: how many were
 * asked for and in what state. Not who, and not what happened at the
 * gates — those are the venue's records.
 */
export async function businessPassSummary(bookingId: string) {
  const guests = await db.bookingGuest.findMany({
    where: { bookingId, removedAt: null },
    select: { entitlement: { include: { credentials: true } } },
  });
  if (!guests.length) return null;
  const counts: Partial<Record<PassState, number>> = {};
  for (const g of guests) {
    const { state } = passState(g.entitlement);
    counts[state] = (counts[state] ?? 0) + 1;
  }
  return { requested: guests.length, states: counts };
}
