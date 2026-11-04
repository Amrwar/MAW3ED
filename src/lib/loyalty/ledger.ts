import { randomUUID } from "crypto";
import type { LoyaltyEntryKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { cairoDayStart } from "@/lib/bookings/instants";
import { availablePoints, drawFromLots, lotExpiry, pointsForVisit, type Lot, type ProgramRules } from "./rules";

/**
 * The loyalty ledger (docs/architecture/LOYALTY_LEDGER.md).
 *
 * Invariants, each held in two places — here, and by the database:
 *
 *   - every event happens once: an entry's sourceKey is unique, so a
 *     replayed completion, a double-clicked redemption or a second refund
 *     callback inserts nothing the second time (LoyaltyEntry_sourceKey_key);
 *   - an account's balance equals the sum of its entries, and is moved
 *     only together with an entry, in one transaction, with the account
 *     row locked (SELECT … FOR UPDATE), so two redemptions racing are
 *     serialised and the second sees what the first spent;
 *   - a balance never goes below zero (LoyaltyAccount_balance_chk), and a
 *     lot never below zero or above what it was (LoyaltyEntry_lot_chk);
 *   - spending draws from unexpired lots, oldest expiry first.
 *
 * Nothing here sends a message. A reward never triggers another reward:
 * earning reacts to a booking being COMPLETED, nothing reacts to an entry.
 */

type Tx = Prisma.TransactionClient;

export interface ProgramRow extends ProgramRules {
  id: string;
  businessId: string | null;
  organizationId: string | null;
  nameAr: string;
  nameEn: string | null;
  isActive: boolean;
}

const PROGRAM_SELECT = {
  id: true, businessId: true, organizationId: true, nameAr: true, nameEn: true, isActive: true,
  pointsPerVisit: true, pointsPer100Egp: true, redeemPoints: true, redeemValueCents: true,
  maxRedeemPercent: true, expiryDays: true, dailyEarnCap: true,
} satisfies Prisma.LoyaltyProgramSelect;

/**
 * The program a business's bookings earn and spend in: its own, if it has
 * an active one; otherwise an organization's it accepted to join — and only
 * while the organization still OWNS it (an approved OWNED association). A
 * mall that merely hosts a business never reaches its customers' points.
 */
export async function programForBusiness(businessId: string, client: Tx | typeof db = db): Promise<ProgramRow | null> {
  const own = await client.loyaltyProgram.findUnique({ where: { businessId }, select: PROGRAM_SELECT });
  if (own?.isActive) return own;
  if (own) return null; // the business turned its own program off: it opted out, not into another
  const joined = await client.loyaltyParticipation.findFirst({
    where: {
      businessId,
      acceptedAt: { not: null },
      leftAt: null,
      program: {
        isActive: true,
        organization: {
          associations: { some: { businessId, relation: "OWNED", status: "APPROVED", suspendedAt: null } },
        },
      },
    },
    select: { program: { select: PROGRAM_SELECT } },
  });
  return joined?.program ?? null;
}

/** Locks (creating if needed) the account for this program and phone. */
async function lockAccount(tx: Tx, programId: string, phoneE164: string) {
  await tx.$executeRaw`
    INSERT INTO "LoyaltyAccount" ("id", "programId", "phoneE164", "balance", "lifetimeEarned", "createdAt", "updatedAt")
    VALUES (${randomUUID()}, ${programId}, ${phoneE164}, 0, 0, now(), now())
    ON CONFLICT ("programId", "phoneE164") DO NOTHING`;
  const rows = await tx.$queryRaw<{ id: string; balance: number }[]>`
    SELECT "id", "balance" FROM "LoyaltyAccount"
     WHERE "programId" = ${programId} AND "phoneE164" = ${phoneE164}
     FOR UPDATE`;
  return rows[0];
}

/** An account's spendable lots, locked. */
async function lockedLots(tx: Tx, accountId: string): Promise<Lot[]> {
  return tx.$queryRaw<Lot[]>`
    SELECT "id", "remaining", "expiresAt", "createdAt" FROM "LoyaltyEntry"
     WHERE "accountId" = ${accountId} AND "remaining" > 0
     ORDER BY "createdAt" ASC
     FOR UPDATE`;
}

/** Inserts an entry once; false when its sourceKey already exists. */
async function insertEntry(
  tx: Tx,
  e: {
    programId: string; accountId: string; kind: LoyaltyEntryKind; points: number;
    remaining?: number | null; expiresAt?: Date | null; bookingId?: string | null;
    businessId?: string | null; sourceKey: string; note?: string | null; actorUserId?: string | null;
  },
): Promise<boolean> {
  const n = await tx.$executeRaw`
    INSERT INTO "LoyaltyEntry" ("id", "programId", "accountId", "kind", "points", "remaining", "expiresAt",
                                "bookingId", "businessId", "sourceKey", "note", "actorUserId", "createdAt")
    VALUES (${randomUUID()}, ${e.programId}, ${e.accountId}, ${e.kind}::"LoyaltyEntryKind", ${e.points},
            ${e.remaining ?? null}, ${e.expiresAt ?? null}, ${e.bookingId ?? null}, ${e.businessId ?? null},
            ${e.sourceKey}, ${e.note ?? null}, ${e.actorUserId ?? null}, now())
    ON CONFLICT ("sourceKey") DO NOTHING`;
  return n === 1;
}

/**
 * Whether an event already happened. Asked under the account lock, before
 * any lot is touched: a replay must not draw from lots and only then find
 * its entry already written.
 */
async function happened(tx: Tx, sourceKey: string): Promise<boolean> {
  return (await tx.loyaltyEntry.count({ where: { sourceKey } })) > 0;
}

/** An entry that lost its insert after lots were drawn: undo the whole transaction. */
class ReplayAfterDraw extends Error {}

async function moveBalance(tx: Tx, accountId: string, delta: number, earned = 0) {
  // The CHECK (balance >= 0) is the floor; callers never ask for more than
  // the lots they drew, so it never fires in practice.
  await tx.$executeRaw`
    UPDATE "LoyaltyAccount"
       SET "balance" = "balance" + ${delta}, "lifetimeEarned" = "lifetimeEarned" + ${earned}, "updatedAt" = now()
     WHERE "id" = ${accountId}`;
}

async function draw(tx: Tx, accountId: string, points: number, now: Date) {
  const lots = await lockedLots(tx, accountId);
  const { draws, shortfall } = drawFromLots(lots, points, now);
  for (const d of draws) {
    await tx.$executeRaw`UPDATE "LoyaltyEntry" SET "remaining" = "remaining" - ${d.take} WHERE "id" = ${d.id} AND "remaining" >= ${d.take}`;
  }
  return points - shortfall;
}

// ─── Earning ─────────────────────────────────────────────────────────────────

export type EarnOutcome =
  | { earned: number; entry: true }
  | { earned: 0; skipped: "no-program" | "test" | "no-phone" | "nothing" | "daily-cap" | "self" | "already" | "not-completed" };

/**
 * A completed booking earns points, once. Called inside the transaction
 * that moves it to COMPLETED (lib/bookings/state.ts), so the points stand
 * or fall with the completion.
 *
 * Not earned: an owner's test booking; a booking without a phone; the
 * business owner's own number (no rewarding oneself); past the daily cap
 * of earning visits per customer.
 */
export async function earnForBooking(tx: Tx, bookingId: string, now: Date = new Date()): Promise<EarnOutcome> {
  const b = await tx.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true, isTest: true, businessId: true, customerPhoneE164: true, totalPrice: true,
      business: { select: { owner: { select: { phone: true } } } },
    },
  });
  if (!b || b.status !== "COMPLETED") return { earned: 0, skipped: "not-completed" };
  if (b.isTest) return { earned: 0, skipped: "test" };
  if (!b.customerPhoneE164) return { earned: 0, skipped: "no-phone" };
  if (b.business.owner.phone && b.business.owner.phone === b.customerPhoneE164) return { earned: 0, skipped: "self" };
  const program = await programForBusiness(b.businessId, tx);
  if (!program) return { earned: 0, skipped: "no-program" };

  const points = pointsForVisit(program, Math.round(Number(b.totalPrice) * 100));
  if (points <= 0) return { earned: 0, skipped: "nothing" };

  const account = await lockAccount(tx, program.id, b.customerPhoneE164);
  // Earning visits today (Cairo), under the account lock: two completions
  // racing cannot both slip under the cap.
  const today = await tx.loyaltyEntry.count({
    where: { accountId: account.id, kind: "EARN", createdAt: { gte: cairoDayStart(now) } },
  });
  if (today >= program.dailyEarnCap) return { earned: 0, skipped: "daily-cap" };

  const inserted = await insertEntry(tx, {
    programId: program.id, accountId: account.id, kind: "EARN", points, remaining: points,
    expiresAt: lotExpiry(program, now), bookingId, businessId: b.businessId, sourceKey: `earn:${bookingId}`,
  });
  if (!inserted) return { earned: 0, skipped: "already" };
  await moveBalance(tx, account.id, points, points);
  return { earned: points, entry: true };
}

// ─── Spending ────────────────────────────────────────────────────────────────

export class LoyaltyInsufficient extends Error {
  constructor() {
    super("loyalty-insufficient");
  }
}

/**
 * Spends points on a booking, inside the booking's own transaction
 * (lib/bookings/create.ts): the booking and the spend commit together or
 * not at all. Throws LoyaltyInsufficient when the unexpired lots no longer
 * cover it — a redemption racing another from the same account.
 */
export async function redeemForBooking(
  tx: Tx,
  r: { programId: string; phoneE164: string; bookingId: string; businessId: string; points: number },
  now: Date = new Date(),
): Promise<void> {
  if (r.points <= 0) return;
  const account = await lockAccount(tx, r.programId, r.phoneE164);
  const lots = await lockedLots(tx, account.id);
  if (availablePoints(lots, now) < r.points) throw new LoyaltyInsufficient();
  const taken = await draw(tx, account.id, r.points, now);
  if (taken < r.points) throw new LoyaltyInsufficient();
  const inserted = await insertEntry(tx, {
    programId: r.programId, accountId: account.id, kind: "REDEEM", points: -r.points,
    bookingId: r.bookingId, businessId: r.businessId, sourceKey: `redeem:${r.bookingId}`,
  });
  if (!inserted) throw new LoyaltyInsufficient(); // a booking id is new; this cannot happen twice
  await moveBalance(tx, account.id, -r.points);
}

/**
 * A booking that spent points was cancelled (or its payment failed): the
 * points come back, once, as a fresh lot. Called from releaseBookingHold,
 * which every path that gives a time back goes through.
 */
export async function reverseRedemption(tx: Tx, bookingId: string, now: Date = new Date()): Promise<number> {
  const spent = await tx.loyaltyEntry.findUnique({
    where: { sourceKey: `redeem:${bookingId}` },
    select: { programId: true, accountId: true, points: true, businessId: true, program: { select: { expiryDays: true } } },
  });
  if (!spent) return 0;
  const back = -spent.points;
  await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${spent.accountId} FOR UPDATE`;
  const inserted = await insertEntry(tx, {
    programId: spent.programId, accountId: spent.accountId, kind: "REDEEM_REVERSAL", points: back,
    remaining: back, expiresAt: lotExpiry(spent.program, now), bookingId, businessId: spent.businessId,
    sourceKey: `redeem-reversal:${bookingId}`,
  });
  if (!inserted) return 0;
  await moveBalance(tx, spent.accountId, back);
  return back;
}

/**
 * The payment for a completed booking was refunded (all or `fraction` of
 * it): the points it earned go back, proportionally, once per refund. If
 * the customer has already spent them, what is left is taken and the
 * shortfall noted — a balance never goes negative.
 */
export async function reverseEarn(
  tx: Tx,
  bookingId: string,
  fraction: number,
  refundKey: string,
  now: Date = new Date(),
): Promise<{ reversed: number; shortfall: number }> {
  const earned = await tx.loyaltyEntry.findUnique({
    where: { sourceKey: `earn:${bookingId}` },
    select: { programId: true, accountId: true, points: true, businessId: true },
  });
  if (!earned) return { reversed: 0, shortfall: 0 };
  await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${earned.accountId} FOR UPDATE`;
  const sourceKey = `earn-reversal:${bookingId}:${refundKey}`;
  if (await happened(tx, sourceKey)) return { reversed: 0, shortfall: 0 };
  const already = await tx.loyaltyEntry.aggregate({
    where: { kind: "EARN_REVERSAL", bookingId, accountId: earned.accountId },
    _sum: { points: true },
  });
  const left = earned.points + (already._sum.points ?? 0); // reversal points are negative
  const want = Math.min(left, Math.round(earned.points * Math.min(1, Math.max(0, fraction))));
  if (want <= 0) return { reversed: 0, shortfall: 0 };
  const taken = await draw(tx, earned.accountId, want, now);
  if (taken <= 0) return { reversed: 0, shortfall: want };
  const inserted = await insertEntry(tx, {
    programId: earned.programId, accountId: earned.accountId, kind: "EARN_REVERSAL", points: -taken,
    bookingId, businessId: earned.businessId, sourceKey,
    note: taken < want ? `refund reversal short by ${want - taken} (already spent)` : null,
  });
  if (!inserted) throw new ReplayAfterDraw();
  await moveBalance(tx, earned.accountId, -taken);
  return { reversed: taken, shortfall: want - taken };
}

// ─── The owner, by hand ──────────────────────────────────────────────────────

/**
 * An owner's correction, with a reason. Adding makes a lot; taking draws
 * from lots and never below zero. `key` makes a retried request a no-op.
 */
export async function adjustPoints(
  r: { programId: string; phoneE164: string; points: number; note: string; actorUserId: string; key: string; businessId?: string | null },
  now: Date = new Date(),
): Promise<{ applied: number }> {
  if (!Number.isInteger(r.points) || r.points === 0 || Math.abs(r.points) > 100_000) return { applied: 0 };
  return db.$transaction(async (tx) => {
    const program = await tx.loyaltyProgram.findUnique({ where: { id: r.programId }, select: { expiryDays: true } });
    if (!program) return { applied: 0 };
    const account = await lockAccount(tx, r.programId, r.phoneE164);
    if (await happened(tx, `adjust:${r.key}`)) return { applied: 0 };
    let applied = r.points;
    if (r.points < 0) {
      applied = -(await draw(tx, account.id, -r.points, now));
      if (applied === 0) return { applied: 0 };
    }
    const inserted = await insertEntry(tx, {
      programId: r.programId, accountId: account.id, kind: "ADJUST", points: applied,
      remaining: applied > 0 ? applied : null, expiresAt: applied > 0 ? lotExpiry(program, now) : null,
      businessId: r.businessId ?? null, sourceKey: `adjust:${r.key}`, note: r.note.slice(0, 300), actorUserId: r.actorUserId,
    });
    if (!inserted) throw new ReplayAfterDraw();
    await moveBalance(tx, account.id, applied, applied > 0 ? applied : 0);
    return { applied };
  });
}

// ─── Expiry ──────────────────────────────────────────────────────────────────

/**
 * Lots past their expiry lose what is left of them, once each. Bounded per
 * run (`limit`); the cron calls it again next time. Each lot in its own
 * short transaction, so one bad row cannot stop the rest.
 */
export async function expireDueLots(now: Date = new Date(), limit = 500): Promise<{ expired: number; points: number }> {
  const due = await db.loyaltyEntry.findMany({
    where: { remaining: { gt: 0 }, expiresAt: { lte: now } },
    select: { id: true },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });
  let expired = 0;
  let points = 0;
  for (const { id } of due) {
    try {
      const n = await db.$transaction(async (tx) => {
        const lot = await tx.loyaltyEntry.findUnique({ where: { id }, select: { accountId: true, programId: true, businessId: true } });
        if (!lot) return 0;
        await tx.$queryRaw`SELECT "id" FROM "LoyaltyAccount" WHERE "id" = ${lot.accountId} FOR UPDATE`;
        const rows = await tx.$queryRaw<{ remaining: number }[]>`
          SELECT "remaining" FROM "LoyaltyEntry" WHERE "id" = ${id} AND "remaining" > 0 AND "expiresAt" <= ${now} FOR UPDATE`;
        const left = rows[0]?.remaining ?? 0;
        if (left <= 0) return 0;
        const inserted = await insertEntry(tx, {
          programId: lot.programId, accountId: lot.accountId, kind: "EXPIRE", points: -left,
          businessId: lot.businessId, sourceKey: `expire:${id}`,
        });
        if (!inserted) return 0;
        await tx.$executeRaw`UPDATE "LoyaltyEntry" SET "remaining" = 0 WHERE "id" = ${id}`;
        await moveBalance(tx, lot.accountId, -left);
        return left;
      });
      if (n > 0) {
        expired++;
        points += n;
      }
    } catch (e) {
      log.error("[loyalty] could not expire a lot", e, { id });
    }
  }
  return { expired, points };
}

// ─── Reading ─────────────────────────────────────────────────────────────────

/** What a customer can spend at a business now, and the program's rules. */
export async function spendableAt(businessId: string, phoneE164: string, now: Date = new Date()) {
  const program = await programForBusiness(businessId);
  if (!program) return null;
  const account = await db.loyaltyAccount.findUnique({
    where: { programId_phoneE164: { programId: program.id, phoneE164 } },
    select: { id: true, balance: true },
  });
  if (!account) return { program, available: 0, balance: 0 };
  const lots = await db.loyaltyEntry.findMany({
    where: { accountId: account.id, remaining: { gt: 0 } },
    select: { id: true, remaining: true, expiresAt: true, createdAt: true },
  });
  return { program, available: availablePoints(lots as Lot[], now), balance: account.balance };
}
