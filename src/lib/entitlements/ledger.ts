import type { PaymentMethod, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { nextReceiptNumber } from "@/lib/payments/ledger";
import { coversService, nextPeriod, packageExpiry, pauseRunsOutAt, pauseShift, MAX_PAUSE_DAYS } from "./rules";
import { log } from "@/lib/logger";

/**
 * Packages (sessions bought ahead) and memberships (a fee per period with
 * included visits) — docs/architecture/MEMBERSHIPS_AND_PACKAGES.md.
 *
 * Every balance moves by one conditional UPDATE whose WHERE carries the
 * rule ("only while ACTIVE, only if a session is left, only for a time
 * before it expires"), so two bookings racing for the last session
 * cannot both take it; CHECK constraints are the floor under that
 * (CustomerPackage_use_chk, MembershipPeriod_use_chk). A booking uses an
 * entitlement at most once (EntitlementUse.bookingId is unique) and gives
 * it back at most once (reversedAt, set conditionally).
 *
 * Sales are taken at the desk (provider MANUAL: cash or card at the
 * counter) and recorded as a Payment of kind PACKAGE or MEMBERSHIP with a
 * receipt number. Selling online through Paymob is not built in Phase 27.
 */

type Tx = Prisma.TransactionClient;

export class EntitlementGone extends Error {
  constructor() {
    super("entitlement-gone");
  }
}

export type EntitlementRef = { packageId: string } | { membershipId: string };

/**
 * Takes one session (package) or one visit (membership) for a booking,
 * inside the booking's own transaction (lib/bookings/create.ts). Throws
 * EntitlementGone when there is nothing left to take for that time and
 * service, for that customer, at that business.
 */
export async function consumeEntitlement(
  tx: Tx,
  ref: EntitlementRef,
  b: { bookingId: string; businessId: string; phoneE164: string; serviceId: string; startsAt: Date },
): Promise<void> {
  if ("packageId" in ref) {
    const n = await tx.$executeRaw`
      UPDATE "CustomerPackage"
         SET "sessionsUsed" = "sessionsUsed" + 1,
             "status" = CASE WHEN "sessionsUsed" + 1 >= "sessionsTotal" THEN 'EXHAUSTED'::"PackageStatus" ELSE "status" END,
             "updatedAt" = now()
       WHERE "id" = ${ref.packageId}
         AND "businessId" = ${b.businessId}
         AND "phoneE164" = ${b.phoneE164}
         AND "status" = 'ACTIVE'
         AND "sessionsUsed" < "sessionsTotal"
         AND ("expiresAt" IS NULL OR "expiresAt" > ${b.startsAt})
         AND (cardinality("serviceIds") = 0 OR ${b.serviceId} = ANY("serviceIds"))`;
    if (n !== 1) throw new EntitlementGone();
    await tx.entitlementUse.create({ data: { bookingId: b.bookingId, packageId: ref.packageId } });
    return;
  }
  // The visit counts against the paid period its appointment falls in.
  const rows = await tx.$queryRaw<{ id: string }[]>`
    UPDATE "MembershipPeriod" p
       SET "used" = p."used" + 1
      FROM "CustomerMembership" m
     WHERE p."membershipId" = m."id"
       AND m."id" = ${ref.membershipId}
       AND m."businessId" = ${b.businessId}
       AND m."phoneE164" = ${b.phoneE164}
       AND m."status" = 'ACTIVE'
       AND (cardinality(m."serviceIds") = 0 OR ${b.serviceId} = ANY(m."serviceIds"))
       AND p."startsAt" <= ${b.startsAt} AND p."endsAt" > ${b.startsAt}
       AND p."used" < p."includedVisits"
    RETURNING p."id"`;
  if (rows.length !== 1) throw new EntitlementGone();
  await tx.entitlementUse.create({
    data: { bookingId: b.bookingId, membershipId: ref.membershipId, periodId: rows[0].id },
  });
}

/**
 * A booking that used a session or visit was cancelled (or its payment
 * failed): it comes back, once. Called from releaseBookingHold. A no-show
 * keeps it used — the slot was held — which is the policy the business
 * page states.
 */
export async function releaseEntitlement(tx: Tx, bookingId: string, now: Date = new Date()): Promise<boolean> {
  const rows = await tx.$queryRaw<{ packageId: string | null; periodId: string | null }[]>`
    UPDATE "EntitlementUse" SET "reversedAt" = ${now}
     WHERE "bookingId" = ${bookingId} AND "reversedAt" IS NULL
    RETURNING "packageId", "periodId"`;
  const use = rows[0];
  if (!use) return false;
  if (use.packageId) {
    // An exhausted package comes back to life; an expired, cancelled or
    // refunded one stays as it is (the session is still returned to the
    // count, so the record adds up).
    await tx.$executeRaw`
      UPDATE "CustomerPackage"
         SET "sessionsUsed" = "sessionsUsed" - 1,
             "status" = CASE WHEN "status" = 'EXHAUSTED' AND ("expiresAt" IS NULL OR "expiresAt" > ${now})
                             THEN 'ACTIVE'::"PackageStatus" ELSE "status" END,
             "updatedAt" = now()
       WHERE "id" = ${use.packageId} AND "sessionsUsed" > 0`;
  } else if (use.periodId) {
    await tx.$executeRaw`UPDATE "MembershipPeriod" SET "used" = "used" - 1 WHERE "id" = ${use.periodId} AND "used" > 0`;
  }
  return true;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export interface UsableEntitlement {
  kind: "package" | "membership";
  id: string;
  nameAr: string;
  nameEn: string | null;
  /** Sessions or visits left that this booking could take. */
  left: number;
  expiresAt: Date | null;
}

/** What a customer holds at a business that would cover this service at this time. */
export async function usableEntitlements(
  businessId: string,
  phoneE164: string,
  serviceId: string,
  startsAt: Date,
): Promise<UsableEntitlement[]> {
  const [packages, memberships] = await Promise.all([
    db.customerPackage.findMany({
      where: { businessId, phoneE164, status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: startsAt } }] },
      select: { id: true, serviceIds: true, sessionsTotal: true, sessionsUsed: true, expiresAt: true, plan: { select: { nameAr: true, nameEn: true } } },
      orderBy: { expiresAt: "asc" },
      take: 10,
    }),
    db.customerMembership.findMany({
      where: { businessId, phoneE164, status: "ACTIVE" },
      select: {
        id: true, serviceIds: true, plan: { select: { nameAr: true, nameEn: true } },
        periods: { where: { startsAt: { lte: startsAt }, endsAt: { gt: startsAt } }, select: { includedVisits: true, used: true, endsAt: true }, take: 1 },
      },
      take: 10,
    }),
  ]);
  const out: UsableEntitlement[] = [];
  for (const p of packages) {
    if (!coversService(p.serviceIds, serviceId) || p.sessionsUsed >= p.sessionsTotal) continue;
    out.push({ kind: "package", id: p.id, nameAr: p.plan.nameAr, nameEn: p.plan.nameEn, left: p.sessionsTotal - p.sessionsUsed, expiresAt: p.expiresAt });
  }
  for (const m of memberships) {
    const period = m.periods[0];
    if (!period || !coversService(m.serviceIds, serviceId) || period.used >= period.includedVisits) continue;
    out.push({ kind: "membership", id: m.id, nameAr: m.plan.nameAr, nameEn: m.plan.nameEn, left: period.includedVisits - period.used, expiresAt: period.endsAt });
  }
  return out;
}

// ─── Selling, at the desk ────────────────────────────────────────────────────

export interface DeskSale {
  businessId: string;
  planId: string;
  phoneE164: string;
  customerName: string;
  method: PaymentMethod;
  recordedById: string;
}

export type SaleResult<T> = { ok: true; value: T } | { ok: false; why: "plan-not-found" | "plan-inactive" };

export async function sellPackage(s: DeskSale, now: Date = new Date()): Promise<SaleResult<{ id: string; receiptNumber: string }>> {
  const plan = await db.packagePlan.findFirst({ where: { id: s.planId, businessId: s.businessId } });
  if (!plan) return { ok: false, why: "plan-not-found" };
  if (!plan.isActive) return { ok: false, why: "plan-inactive" };
  return db.$transaction(async (tx) => {
    const pkg = await tx.customerPackage.create({
      data: {
        planId: plan.id, businessId: s.businessId, phoneE164: s.phoneE164, customerName: s.customerName.slice(0, 120),
        serviceIds: plan.serviceIds, sessionsTotal: plan.sessions, priceCents: plan.priceCents,
        status: "ACTIVE", activatedAt: now, expiresAt: packageExpiry(now, plan.validityDays),
      },
      select: { id: true },
    });
    const receiptNumber = await nextReceiptNumber(tx);
    await tx.payment.create({
      data: {
        kind: "PACKAGE", businessId: s.businessId, customerPackageId: pkg.id, amountCents: plan.priceCents,
        provider: "MANUAL", method: s.method, status: "SUCCEEDED", paidAt: now, recordedById: s.recordedById, receiptNumber,
      },
    });
    return { ok: true as const, value: { id: pkg.id, receiptNumber } };
  });
}

export async function sellMembership(s: DeskSale, now: Date = new Date()): Promise<SaleResult<{ id: string; receiptNumber: string }>> {
  const plan = await db.membershipPlan.findFirst({ where: { id: s.planId, businessId: s.businessId } });
  if (!plan) return { ok: false, why: "plan-not-found" };
  if (!plan.isActive) return { ok: false, why: "plan-inactive" };
  const period = nextPeriod(null, plan.periodDays, now)!;
  return db.$transaction(async (tx) => {
    const m = await tx.customerMembership.create({
      data: {
        planId: plan.id, businessId: s.businessId, phoneE164: s.phoneE164, customerName: s.customerName.slice(0, 120),
        serviceIds: plan.serviceIds, includedVisits: plan.includedVisits, periodDays: plan.periodDays, priceCents: plan.priceCents,
        status: "ACTIVE", paidThrough: period.endsAt,
      },
      select: { id: true },
    });
    const receiptNumber = await nextReceiptNumber(tx);
    const payment = await tx.payment.create({
      data: {
        kind: "MEMBERSHIP", businessId: s.businessId, customerMembershipId: m.id, amountCents: plan.priceCents,
        provider: "MANUAL", method: s.method, status: "SUCCEEDED", paidAt: now, recordedById: s.recordedById, receiptNumber,
      },
      select: { id: true },
    });
    await tx.membershipPeriod.create({
      data: { membershipId: m.id, startsAt: period.startsAt, endsAt: period.endsAt, includedVisits: plan.includedVisits, paymentId: payment.id },
    });
    return { ok: true as const, value: { id: m.id, receiptNumber } };
  });
}

export type MembershipChange =
  | { ok: true }
  | { ok: false; why: "not-found" | "wrong-status" | "paid-ahead" | "no-pause-left" };

/**
 * Pays the next period, at the price and visits the membership was sold
 * at. Under a row lock, so two renewals at once cannot both add the
 * same period; bounded MAX_PERIODS_AHEAD ahead.
 */
export async function renewMembership(
  r: { businessId: string; membershipId: string; method: PaymentMethod; recordedById: string },
  now: Date = new Date(),
): Promise<MembershipChange> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; status: string; paidThrough: Date | null; periodDays: number; includedVisits: number; priceCents: number }[]>`
      SELECT "id", "status"::text AS status, "paidThrough", "periodDays", "includedVisits", "priceCents"
        FROM "CustomerMembership" WHERE "id" = ${r.membershipId} AND "businessId" = ${r.businessId} FOR UPDATE`;
    const m = rows[0];
    if (!m) return { ok: false, why: "not-found" };
    if (m.status !== "ACTIVE" && m.status !== "EXPIRED") return { ok: false, why: "wrong-status" };
    const period = nextPeriod(m.status === "EXPIRED" ? null : m.paidThrough, m.periodDays, now);
    if (!period) return { ok: false, why: "paid-ahead" };
    const payment = await tx.payment.create({
      data: {
        kind: "MEMBERSHIP", businessId: r.businessId, customerMembershipId: m.id, amountCents: m.priceCents,
        provider: "MANUAL", method: r.method, status: "SUCCEEDED", paidAt: now, recordedById: r.recordedById,
        receiptNumber: await nextReceiptNumber(tx),
      },
      select: { id: true },
    });
    await tx.membershipPeriod.create({
      data: { membershipId: m.id, startsAt: period.startsAt, endsAt: period.endsAt, includedVisits: m.includedVisits, paymentId: payment.id },
    });
    await tx.customerMembership.update({
      where: { id: m.id },
      data: { status: "ACTIVE", paidThrough: period.endsAt, cancelAtPeriodEnd: false },
    });
    return { ok: true };
  });
}

/** Pause: no visits are taken while paused; the paid time moves on resume. */
export async function pauseMembership(businessId: string, membershipId: string, now: Date = new Date()): Promise<MembershipChange> {
  const m = await db.customerMembership.findFirst({ where: { id: membershipId, businessId }, select: { pausedDays: true } });
  if (!m) return { ok: false, why: "not-found" };
  if (m.pausedDays >= MAX_PAUSE_DAYS) return { ok: false, why: "no-pause-left" };
  const { count } = await db.customerMembership.updateMany({
    where: { id: membershipId, businessId, status: "ACTIVE", paidThrough: { gt: now } },
    data: { status: "PAUSED", pausedAt: now },
  });
  return count === 1 ? { ok: true } : { ok: false, why: "wrong-status" };
}

/**
 * Resume: every paid period not yet over when the pause began moves on by
 * the length of the pause (whole days, within the allowance), so the
 * customer loses no paid time.
 */
export async function resumeMembership(businessId: string, membershipId: string, now: Date = new Date()): Promise<MembershipChange> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ pausedAt: Date | null; pausedDays: number; status: string }[]>`
      SELECT "pausedAt", "pausedDays", "status"::text AS status FROM "CustomerMembership"
       WHERE "id" = ${membershipId} AND "businessId" = ${businessId} FOR UPDATE`;
    const m = rows[0];
    if (!m) return { ok: false, why: "not-found" };
    if (m.status !== "PAUSED" || !m.pausedAt) return { ok: false, why: "wrong-status" };
    const shift = pauseShift(m.pausedAt, now, m.pausedDays);
    const ms = `${shift.ms} milliseconds`;
    await tx.$executeRaw`
      UPDATE "MembershipPeriod"
         SET "startsAt" = CASE WHEN "startsAt" > ${m.pausedAt} THEN "startsAt" + ${ms}::interval ELSE "startsAt" END,
             "endsAt" = "endsAt" + ${ms}::interval
       WHERE "membershipId" = ${membershipId} AND "endsAt" > ${m.pausedAt}`;
    await tx.$executeRaw`
      UPDATE "CustomerMembership"
         SET "status" = 'ACTIVE', "pausedAt" = NULL, "pausedDays" = "pausedDays" + ${shift.days},
             "paidThrough" = "paidThrough" + ${ms}::interval, "updatedAt" = now()
       WHERE "id" = ${membershipId}`;
    return { ok: true };
  });
}

/**
 * Cancel. At period end: it runs out when its paid time does. Now: it
 * stops at once; money back, if any, is a separate refund.
 */
export async function cancelMembership(businessId: string, membershipId: string, when: "now" | "period-end"): Promise<MembershipChange> {
  if (when === "period-end") {
    const { count } = await db.customerMembership.updateMany({
      where: { id: membershipId, businessId, status: { in: ["ACTIVE", "PAUSED"] } },
      data: { cancelAtPeriodEnd: true },
    });
    return count === 1 ? { ok: true } : { ok: false, why: "wrong-status" };
  }
  const { count } = await db.customerMembership.updateMany({
    where: { id: membershipId, businessId, status: { in: ["ACTIVE", "PAUSED", "EXPIRED"] } },
    data: { status: "CANCELLED", pausedAt: null },
  });
  return count === 1 ? { ok: true } : { ok: false, why: "wrong-status" };
}

/** Cancels a package (no further sessions). Money back is a separate refund. */
export async function cancelPackage(businessId: string, packageId: string): Promise<boolean> {
  const { count } = await db.customerPackage.updateMany({
    where: { id: packageId, businessId, status: { in: ["ACTIVE", "EXHAUSTED", "EXPIRED"] } },
    data: { status: "CANCELLED" },
  });
  return count === 1;
}

export type DeskRefund =
  | { ok: true; refundedCents: number }
  | { ok: false; why: "not-found" | "too-much" | "live-bookings" | "nothing-paid" };

/**
 * Money handed back at the desk for a package or a membership. Refused
 * while upcoming bookings still hold its sessions — cancel those first,
 * or the customer would keep a prepaid visit they were refunded for. The
 * reservation is a conditional update on the payment, so two refunds
 * cannot both pass the "not more than was paid" check.
 *
 * A package refunded becomes REFUNDED; a membership is cancelled.
 */
export async function refundAtDesk(
  r: { businessId: string; target: EntitlementRef; amountCents: number; reason: string; actorId: string; actorName: string },
  now: Date = new Date(),
): Promise<DeskRefund> {
  if (!Number.isInteger(r.amountCents) || r.amountCents <= 0) return { ok: false, why: "too-much" };
  return db.$transaction(async (tx) => {
    const isPackage = "packageId" in r.target;
    const id = "packageId" in r.target ? r.target.packageId : r.target.membershipId;
    const owner = isPackage
      ? await tx.customerPackage.findFirst({ where: { id, businessId: r.businessId }, select: { id: true } })
      : await tx.customerMembership.findFirst({ where: { id, businessId: r.businessId }, select: { id: true } });
    if (!owner) return { ok: false, why: "not-found" };

    const live = await tx.entitlementUse.count({
      where: {
        ...(isPackage ? { packageId: id } : { membershipId: id }),
        reversedAt: null,
        booking: { status: { in: ["PENDING", "PENDING_PAYMENT", "CONFIRMED", "ARRIVED", "IN_PROGRESS"] } },
      },
    });
    if (live > 0) return { ok: false, why: "live-bookings" };

    // Newest payment first: a membership's latest period is refunded first.
    const payments = await tx.payment.findMany({
      where: {
        ...(isPackage ? { customerPackageId: id } : { customerMembershipId: id }),
        provider: "MANUAL", status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] },
      },
      select: { id: true, amountCents: true, refundedCents: true },
      orderBy: { createdAt: "desc" },
    });
    if (payments.length === 0) return { ok: false, why: "nothing-paid" };
    let left = r.amountCents;
    const available = payments.reduce((n, p) => n + p.amountCents - p.refundedCents, 0);
    if (left > available) return { ok: false, why: "too-much" };
    for (const p of payments) {
      if (left === 0) break;
      const take = Math.min(left, p.amountCents - p.refundedCents);
      if (take <= 0) continue;
      const n = await tx.$executeRaw`
        UPDATE "Payment"
           SET "refundedCents" = "refundedCents" + ${take},
               "status" = CASE WHEN "refundedCents" + ${take} >= "amountCents" THEN 'REFUNDED'::"PaymentStatus" ELSE 'PARTIALLY_REFUNDED'::"PaymentStatus" END,
               "updatedAt" = now()
         WHERE "id" = ${p.id} AND "refundedCents" + ${take} <= "amountCents"`;
      if (n !== 1) throw new Error("refund raced; retry");
      await tx.refund.create({
        data: { paymentId: p.id, amountCents: take, status: "SUCCEEDED", reason: r.reason.slice(0, 500), actorId: r.actorId, actorName: r.actorName },
      });
      left -= take;
    }
    if (isPackage) {
      await tx.customerPackage.updateMany({ where: { id, status: { not: "REFUNDED" } }, data: { status: "REFUNDED" } });
    } else {
      await tx.customerMembership.updateMany({ where: { id, status: { not: "CANCELLED" } }, data: { status: "CANCELLED", pausedAt: null } });
    }
    return { ok: true, refundedCents: r.amountCents };
  });
}

// ─── Time passing ────────────────────────────────────────────────────────────

/**
 * The cron's part: packages past their date expire; memberships whose paid
 * time ran out expire (or end as cancelled, when that was asked for); a
 * pause that used up its allowance resumes by itself. Bounded per run.
 */
export async function expireEntitlements(now: Date = new Date(), limit = 500): Promise<{ packages: number; memberships: number; resumed: number }> {
  const packages = await db.$executeRaw`
    UPDATE "CustomerPackage" SET "status" = 'EXPIRED', "updatedAt" = now()
     WHERE "id" IN (SELECT "id" FROM "CustomerPackage" WHERE "status" IN ('ACTIVE', 'EXHAUSTED') AND "expiresAt" <= ${now} LIMIT ${limit})`;
  const memberships = await db.$executeRaw`
    UPDATE "CustomerMembership"
       SET "status" = CASE WHEN "cancelAtPeriodEnd" THEN 'CANCELLED'::"CustomerMembershipStatus" ELSE 'EXPIRED'::"CustomerMembershipStatus" END,
           "updatedAt" = now()
     WHERE "id" IN (SELECT "id" FROM "CustomerMembership" WHERE "status" = 'ACTIVE' AND "paidThrough" <= ${now} LIMIT ${limit})`;
  const paused = await db.customerMembership.findMany({
    where: { status: "PAUSED" },
    select: { id: true, businessId: true, pausedAt: true, pausedDays: true },
    take: limit,
  });
  let resumed = 0;
  for (const m of paused) {
    if (!m.pausedAt || pauseRunsOutAt(m.pausedAt, m.pausedDays) > now) continue;
    try {
      const r = await resumeMembership(m.businessId, m.id, now);
      if (r.ok) resumed++;
    } catch (e) {
      log.error("[entitlements] could not auto-resume a membership", e, { id: m.id });
    }
  }
  return { packages, memberships, resumed };
}
