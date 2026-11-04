import { Prisma, type FunnelStep, type TrafficSource } from "@prisma/client";
import { db } from "@/lib/db";
import { cairoDay, cairoDayBefore } from "@/lib/attribution/day";

/**
 * The booking funnel, read back (docs/analytics/CONVERSION_FUNNELS.md).
 *
 * Two kinds of number, never mixed up:
 *
 *   reported  tabs that reached a step, from FunnelCount — what browsers
 *             said, deduplicated per tab and day (funnel.ts);
 *   recorded  what the records say, from Booking and Payment rows —
 *             bookings made, paid, failed, cancelled, repeat. Bookings
 *             made from the app or by the business's desk are here too,
 *             though no browser step led to them, so "recorded" can
 *             exceed the reported step before it. That is not an error.
 *
 * Scopes:
 *   business      one business's own funnel (its owner, or a delegate
 *                 with reports access);
 *   organization  only what the organization's own directory produced:
 *                 steps credited to it and bookings attributed to it.
 *                 Counts only — no payment outcomes, no amounts, no
 *                 customer. A mall hosting a tenant learns how many
 *                 bookings its directory sent, never anything about
 *                 money or people (ORGANIZATION_PERMISSIONS.md);
 *   platform      everything, for the platform admin.
 *
 * Test bookings never count; abandoned checkouts (PENDING_PAYMENT,
 * FAILED_PAYMENT) are not bookings made.
 */

export type FunnelScope =
  | { kind: "business"; businessId: string }
  | { kind: "organization"; organizationId: string }
  | { kind: "platform" };

export interface FunnelReportData {
  days: number;
  from: string;
  to: string;
  /** Tabs reaching each reported step, in funnel order. */
  steps: Partial<Record<FunnelStep, number>>;
  /** The same, by the channel the tab arrived through. */
  stepsBySource: Partial<Record<FunnelStep, Partial<Record<TrafficSource, number>>>>;
  recorded: {
    /** Bookings made (not abandoned checkouts). */
    made: number;
    /** Of those, cancelled since. */
    cancelled: number;
    /** Of those, by a customer who had booked this business before. */
    repeat: number;
    /** Business and platform scopes only: checkouts started, paid, failed. */
    payment: { started: number; paid: number; failed: number } | null;
  };
  /** Bookings made, by the channel recorded on the booking. */
  madeBySource: Partial<Record<TrafficSource, number>>;
}

/** Last `days` Cairo days, today included. */
export function windowFor(days: number, now: Date = new Date()) {
  const from = cairoDayBefore(days - 1, now);
  const to = cairoDay(now);
  return { from, to, fromStr: from.toISOString().slice(0, 10), toStr: to.toISOString().slice(0, 10) };
}

const ABANDONED_SQL = Prisma.sql`('PENDING_PAYMENT', 'FAILED_PAYMENT')`;

export async function getFunnelReport(scope: FunnelScope, days = 30, now: Date = new Date()): Promise<FunnelReportData> {
  const w = windowFor(days, now);

  const countWhere: Prisma.FunnelCountWhereInput = {
    day: { gte: w.from, lte: w.to },
    ...(scope.kind === "business" ? { businessId: scope.businessId } : {}),
    ...(scope.kind === "organization" ? { organizationId: scope.organizationId } : {}),
  };
  // Booking scope, as SQL. An organization sees only the bookings
  // attributed to its own directory.
  const scopeSql =
    scope.kind === "business"
      ? Prisma.sql`AND bk."businessId" = ${scope.businessId}`
      : scope.kind === "organization"
        ? Prisma.sql`AND EXISTS (SELECT 1 FROM "OrganizationBookingAttribution" a WHERE a."bookingId" = bk.id AND a."organizationId" = ${scope.organizationId})`
        : Prisma.empty;

  // The Cairo day a booking was made on. The createdAt bounds around it
  // (a day either side) let the index narrow the scan first.
  const lo = new Date(w.from.getTime() - 86_400_000);
  const hi = new Date(w.to.getTime() + 2 * 86_400_000);
  const inWindow = Prisma.sql`
    bk."isTest" = false
    AND bk."createdAt" >= ${lo} AND bk."createdAt" < ${hi}
    AND ((bk."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Cairo')::date BETWEEN ${w.from}::date AND ${w.to}::date
    ${scopeSql}`;

  const [grouped, recordedRows, bySourceRows] = await Promise.all([
    db.funnelCount.groupBy({ by: ["step", "source"], where: countWhere, _sum: { count: true } }),
    db.$queryRaw<{ made: number; cancelled: number; repeat: number; started: number; paid: number; failed: number }[]>`
      WITH b AS (
        SELECT bk.id, bk.status, bk."businessId", bk."customerId", bk."customerPhoneE164", bk."createdAt"
        FROM "Booking" bk
        WHERE ${inWindow}
      ),
      pay AS (
        SELECT p."bookingId",
               bool_or(p.status IN ('SUCCEEDED', 'REFUNDED', 'PARTIALLY_REFUNDED')) AS paid,
               bool_or(p.status = 'FAILED') AS failed
        FROM "Payment" p
        WHERE p."bookingId" IN (SELECT id FROM b) AND p.kind IN ('BOOKING_DEPOSIT', 'BOOKING_FULL')
        GROUP BY p."bookingId"
      )
      SELECT
        COUNT(*) FILTER (WHERE b.status NOT IN ${ABANDONED_SQL})::int AS made,
        COUNT(*) FILTER (WHERE b.status = 'CANCELLED')::int AS cancelled,
        COUNT(*) FILTER (
          WHERE b.status NOT IN ${ABANDONED_SQL}
          AND EXISTS (
            SELECT 1 FROM "Booking" prev
            WHERE prev."businessId" = b."businessId"
              AND prev.id <> b.id
              AND prev."isTest" = false
              AND prev.status NOT IN ${ABANDONED_SQL}
              AND prev."createdAt" < b."createdAt"
              AND ((b."customerId" IS NOT NULL AND prev."customerId" = b."customerId")
                OR (b."customerPhoneE164" IS NOT NULL AND prev."customerPhoneE164" = b."customerPhoneE164"))
          )
        )::int AS repeat,
        COUNT(pay."bookingId")::int AS started,
        COUNT(*) FILTER (WHERE pay.paid)::int AS paid,
        COUNT(*) FILTER (WHERE pay.failed AND NOT pay.paid)::int AS failed
      FROM b LEFT JOIN pay ON pay."bookingId" = b.id`,
    db.$queryRaw<{ source: TrafficSource | null; n: number }[]>`
      SELECT bk.source, COUNT(*)::int AS n
      FROM "Booking" bk
      WHERE ${inWindow} AND bk.status NOT IN ${ABANDONED_SQL}
      GROUP BY bk.source`,
  ]);

  const steps: FunnelReportData["steps"] = {};
  const stepsBySource: FunnelReportData["stepsBySource"] = {};
  for (const g of grouped) {
    const n = g._sum.count ?? 0;
    steps[g.step] = (steps[g.step] ?? 0) + n;
    const s = (stepsBySource[g.step] ??= {});
    s[g.source] = (s[g.source] ?? 0) + n;
  }

  const r = recordedRows[0] ?? { made: 0, cancelled: 0, repeat: 0, started: 0, paid: 0, failed: 0 };
  const madeBySource: FunnelReportData["madeBySource"] = {};
  for (const row of bySourceRows) {
    // A booking made before channels were recorded, or by the desk, has
    // none; it is DIRECT in the sense of "we do not know".
    const k = row.source ?? "DIRECT";
    madeBySource[k] = (madeBySource[k] ?? 0) + row.n;
  }

  return {
    days,
    from: w.fromStr,
    to: w.toStr,
    steps,
    stepsBySource,
    recorded: {
      made: r.made,
      cancelled: r.cancelled,
      repeat: r.repeat,
      payment: scope.kind === "organization" ? null : { started: r.started, paid: r.paid, failed: r.failed },
    },
    madeBySource,
  };
}

/** A step as a share of the one before it; null when there is nothing to divide by. */
export function stepRate(n: number | undefined, of: number | undefined): number | null {
  return of && of > 0 ? Math.min(1, (n ?? 0) / of) : null;
}
