import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  bestAutomaticDiscount,
  evaluateDiscount,
  normaliseCode,
  type DiscountFailure,
  type DiscountRules,
} from "./apply";

/**
 * Finding the discount that applies, from the database.
 *
 * The pure rules live in apply.ts. This is the part that loads rows and
 * decides which of them to ask about — kept separate so the rules stay
 * testable without a database, and so there is one place that knows a
 * coupon is looked up by code and a promotion is not.
 */

const SELECT = {
  id: true,
  code: true,
  nameAr: true,
  nameEn: true,
  kind: true,
  value: true,
  minSpendCents: true,
  maxDiscountCents: true,
  maxRedemptions: true,
  perCustomerLimit: true,
  redemptionCount: true,
  startsAt: true,
  endsAt: true,
  isActive: true,
  serviceIds: true,
} as const;

export interface ResolvedDiscount {
  id: string;
  nameAr: string;
  nameEn: string | null;
  code: string | null;
  amountCents: number;
  totalCents: number;
}

export type ResolveResult =
  | { ok: true; discount: ResolvedDiscount }
  | { ok: false; reason: DiscountFailure | "not-found" }
  | { ok: null }; // nothing applies, and nothing was asked for

/**
 * How many times this customer has used this offer.
 *
 * Counted against the Customer record rather than a phone number, so a
 * customer who books under a slightly different spelling of their name
 * is still the same person — the Customer row is keyed on the phone the
 * database normalised.
 */
async function customerRedemptions(discountId: string, customerId: string | null): Promise<number> {
  if (!customerId) return 0;
  return db.discountRedemption.count({ where: { discountId, customerId } });
}

/**
 * A code the customer typed.
 *
 * Only ever looked up inside the business they are booking with: two
 * salons may both run "EID20" and a code must not leak between them.
 */
export async function resolveCode(params: {
  businessId: string;
  serviceId: string;
  subtotalCents: number;
  code: string;
  customerId?: string | null;
  now?: Date;
}): Promise<ResolveResult> {
  const code = normaliseCode(params.code);
  if (!code) return { ok: null };

  const row = await db.discount.findFirst({
    where: { businessId: params.businessId, code },
    select: SELECT,
  });
  if (!row) return { ok: false, reason: "not-found" };

  const used = await customerRedemptions(row.id, params.customerId ?? null);
  const outcome = evaluateDiscount(row as DiscountRules, {
    subtotalCents: params.subtotalCents,
    serviceId: params.serviceId,
    customerRedemptions: used,
    now: params.now ?? new Date(),
  });

  if (!outcome.ok) return { ok: false, reason: outcome.reason };

  return {
    ok: true,
    discount: {
      id: row.id,
      nameAr: row.nameAr,
      nameEn: row.nameEn,
      code: row.code,
      amountCents: outcome.amountCents,
      totalCents: outcome.totalCents,
    },
  };
}

/**
 * The best promotion running right now, if any.
 *
 * Nobody asked for it, so nothing is reported when none applies — an
 * absent promotion is not an error and must not read like one.
 */
export async function resolveAutomatic(params: {
  businessId: string;
  serviceId: string;
  subtotalCents: number;
  customerId?: string | null;
  now?: Date;
}): Promise<ResolveResult> {
  const now = params.now ?? new Date();

  const rows = await db.discount.findMany({
    where: {
      businessId: params.businessId,
      code: null,
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    select: SELECT,
  });
  if (rows.length === 0) return { ok: null };

  // The per-customer limit needs a count per offer. Few enough
  // promotions run at once for this to be cheap, and getting it wrong
  // would let somebody take a once-only offer repeatedly.
  const counts = await Promise.all(
    rows.map((r) => customerRedemptions(r.id, params.customerId ?? null)),
  );

  const withCounts = rows.map((r, i) => ({
    ...(r as DiscountRules),
    // evaluateDiscount reads this off the context, not the rules; the
    // pairing is carried here so the best-of comparison sees it.
    _used: counts[i],
  }));

  let best: { rules: DiscountRules; amountCents: number; totalCents: number } | null = null;
  for (const candidate of withCounts) {
    const single = bestAutomaticDiscount([candidate], {
      subtotalCents: params.subtotalCents,
      serviceId: params.serviceId,
      customerRedemptions: candidate._used,
      now,
    });
    if (!single) continue;
    if (!best || single.amountCents > best.amountCents) best = single;
  }

  if (!best) return { ok: null };

  return {
    ok: true,
    discount: {
      id: best.rules.id,
      nameAr: (best.rules as DiscountRules & { nameAr: string }).nameAr,
      nameEn: (best.rules as DiscountRules & { nameEn: string | null }).nameEn,
      code: null,
      amountCents: best.amountCents,
      totalCents: best.totalCents,
    },
  };
}

/**
 * Take one redemption, or refuse.
 *
 * Raw SQL because the condition compares two columns — "fewer uses than
 * the maximum" — which Prisma's where cannot express, and because the
 * increment and the check have to be the same statement. Reading the
 * count and then writing it lets two people both take the last one.
 *
 * Returns false when the offer ran out between the quote and the
 * booking, which is a real race on a popular promotion.
 */
export async function claimRedemption(
  tx: Prisma.TransactionClient,
  discountId: string,
): Promise<boolean> {
  const updated = await tx.$executeRaw`
    UPDATE "Discount"
       SET "redemptionCount" = "redemptionCount" + 1,
           "updatedAt" = NOW()
     WHERE "id" = ${discountId}
       AND "isActive" = true
       AND ("maxRedemptions" IS NULL OR "redemptionCount" < "maxRedemptions")`;
  return updated === 1;
}
