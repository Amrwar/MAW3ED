import { randomUUID } from "crypto";
import type { FunnelStep, TrafficSource } from "@prisma/client";
import { db } from "@/lib/db";
import { cairoDay } from "@/lib/attribution/day";
import { keyedHash } from "@/lib/rate-limit";
import { LISTED_RELATIONS, PUBLIC_ORG } from "@/lib/organizations/public";
import { FUNNEL_STEPS, BUSINESS_STEPS, PLAIN_STEPS } from "./funnel-steps";

/**
 * Counting the booking funnel, server side.
 *
 * The browser reports that its tab reached a step (funnel-client.ts). The
 * server checks the step is about something public, then counts it once
 * per tab per step per business per organization per Cairo day:
 *
 *   FunnelSeen   a keyed hash of (tab id, step, business, org, day); the
 *                tab id is random, made by the browser, kept only in that
 *                tab's sessionStorage, and never stored here in the clear.
 *                Rows are pruned after two days (pruneFunnelSeen).
 *   FunnelCount  the counter, one row per day/step/channel/business/org.
 *
 * Both writes are one statement, so two reports from the same tab racing
 * each other still count once (the FunnelSeen primary key decides).
 *
 * Nothing about the visitor is stored: no address, cookie, account,
 * user agent or device id. The steps after "time selected" are not
 * reported by anybody — they are read from Booking and Payment rows
 * (funnel-report.ts), the records the business itself works from.
 */

export { FUNNEL_STEPS, BUSINESS_STEPS, PLAIN_STEPS };

export const TAB_ID = /^[A-Za-z0-9_-]{16,64}$/;

export interface FunnelReport {
  step: FunnelStep;
  tab: string;
  source: TrafficSource;
  business?: string | null;
  org?: string | null;
}

export type FunnelOutcome = "counted" | "duplicate" | "ignored";

export async function recordFunnelStep(r: FunnelReport, now: Date = new Date()): Promise<FunnelOutcome> {
  if (!FUNNEL_STEPS.includes(r.step) || !TAB_ID.test(r.tab)) return "ignored";

  let businessId = "";
  let organizationId = "";

  if (BUSINESS_STEPS.includes(r.step)) {
    if (!r.business) return "ignored";
    const b = await db.business.findUnique({ where: { slug: r.business }, select: { id: true, isPublished: true } });
    if (!b?.isPublished) return "ignored";
    businessId = b.id;
    // Credited to an organization only when the business is listed in its
    // public directory — a request cannot invent an affiliation (the same
    // rule as booking attribution, organizations/public.ts).
    if (r.org) {
      const o = await db.organization.findFirst({
        where: {
          slug: r.org,
          ...PUBLIC_ORG,
          associations: { some: { businessId: b.id, status: "APPROVED", relation: { in: [...LISTED_RELATIONS] } } },
        },
        select: { id: true },
      });
      organizationId = o?.id ?? "";
    }
  } else if (r.step === "ORGANIZATION_VIEW") {
    if (!r.org) return "ignored";
    const o = await db.organization.findFirst({ where: { slug: r.org, ...PUBLIC_ORG }, select: { id: true } });
    if (!o) return "ignored";
    organizationId = o.id;
  } else if (!PLAIN_STEPS.includes(r.step)) {
    return "ignored";
  }

  const day = cairoDay(now);
  const counted = await countOnce(r, day, businessId, organizationId);
  // The platform's own row (no business, no organization): the same step
  // counted once per tab across the whole site, so the marketplace funnel
  // counts tabs — not tab-and-business pairs, which a visitor opening
  // three business pages would make three of.
  if (businessId || organizationId) await countOnce(r, day, "", "");
  return counted ? "counted" : "duplicate";
}

/** One deduplicated increment; true when it counted. */
async function countOnce(r: FunnelReport, day: Date, businessId: string, organizationId: string): Promise<boolean> {
  const dayStr = day.toISOString().slice(0, 10);
  const key = keyedHash(`funnel|${r.tab}|${r.step}|${businessId}|${organizationId}|${dayStr}`);
  const counted = await db.$executeRaw`
    WITH seen AS (
      INSERT INTO "FunnelSeen" ("key", "day") VALUES (${key}, ${day}::date)
      ON CONFLICT ("key") DO NOTHING
      RETURNING 1
    )
    INSERT INTO "FunnelCount" ("id", "day", "step", "source", "businessId", "organizationId", "count")
    SELECT ${randomUUID()}, ${day}::date, ${r.step}::"FunnelStep", ${r.source}::"TrafficSource", ${businessId}, ${organizationId}, 1
    FROM seen
    ON CONFLICT ("day", "step", "source", "businessId", "organizationId")
    DO UPDATE SET "count" = "FunnelCount"."count" + 1`;
  return counted > 0;
}

/** Drop dedup markers older than yesterday (Cairo). Called by the daily cron. */
export async function pruneFunnelSeen(now: Date = new Date()): Promise<number> {
  const yesterday = new Date(cairoDay(now).getTime() - 86_400_000);
  const { count } = await db.funnelSeen.deleteMany({ where: { day: { lt: yesterday } } });
  return count;
}
