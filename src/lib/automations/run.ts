import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { cairoWallClock } from "@/lib/bookings/instants";
import { sweepWaitlist } from "@/lib/bookings/slot-waitlist";
import { expireDueLots } from "@/lib/loyalty/ledger";
import { expireEntitlements } from "@/lib/entitlements/ledger";
import { rebookHref } from "@/lib/bookings/rebook";
import { redriveAutomations, sendAutoMessage } from "./send";

/**
 * The operations cron (/api/cron/operations, every 10 minutes): time
 * passing for Phase 27, then the messages it calls for. Every job is
 * bounded per run (BATCH), idempotent (each message has its own key, each
 * expiry its own conditional update or ledger key), and isolated: one
 * job failing is logged and the rest still run. Nothing here reacts to
 * a message being sent, so no job can feed another in a loop.
 */

const BATCH = 200;
/** The most rows one job walks through in one run, across pages. */
const MAX_ROWS = 2_000;
const DAY = 86_400_000;

/**
 * Every row a query matches, a page at a time in id order (so a run
 * reaches the 201st business, not the same first 200 again), up to
 * MAX_ROWS — the rest wait for the next run.
 */
async function allRows<T extends { id: string }>(page: (after: string | undefined, take: number) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  let after: string | undefined;
  while (out.length < MAX_ROWS) {
    const rows = await page(after, BATCH);
    out.push(...rows);
    if (rows.length < BATCH) break;
    after = rows[rows.length - 1].id;
  }
  return out;
}
const afterId = (after: string | undefined) => (after ? { id: { gt: after } } : {});

export interface OperationsRun {
  waitlist?: Awaited<ReturnType<typeof sweepWaitlist>>;
  loyaltyExpired?: Awaited<ReturnType<typeof expireDueLots>>;
  entitlements?: Awaited<ReturnType<typeof expireEntitlements>>;
  followUps?: number;
  rebooks?: number;
  renewals?: number;
  pointsNotices?: number;
  packageNotices?: number;
  redriven?: Awaited<ReturnType<typeof redriveAutomations>>;
  failed: string[];
  /** Jobs not reached before the deadline; they run next time. */
  skipped: string[];
}

export async function runOperations(now: Date = new Date(), budgetMs = 240_000): Promise<OperationsRun> {
  const out: OperationsRun = { failed: [], skipped: [] };
  // A deadline under the function's limit (maxDuration 300 s): a run cut off
  // by the platform would never reach the later jobs, and its messages
  // would stop half-way (final audit F-28). What is not reached runs next
  // time — every job is idempotent.
  const deadline = Date.now() + budgetMs;
  const over = () => Date.now() > deadline;
  const step = async <K extends Exclude<keyof OperationsRun, "failed" | "skipped">>(name: K, f: () => Promise<OperationsRun[K]>) => {
    if (over()) {
      out.skipped.push(String(name));
      return;
    }
    try {
      out[name] = await f();
    } catch (e) {
      out.failed.push(String(name));
      log.error(`[operations] ${String(name)} failed`, e);
    }
  };
  await step("waitlist", () => sweepWaitlist(now, BATCH));
  await step("loyaltyExpired", () => expireDueLots(now, BATCH));
  await step("entitlements", () => expireEntitlements(now, BATCH));
  // Retries of messages already due come before new ones, so a busy run
  // cannot starve them.
  await step("redriven", () => redriveAutomations(now));
  await step("followUps", () => followUps(now, over));
  await step("rebooks", () => rebookNudges(now, over));
  await step("renewals", () => renewalNotices(now, over));
  await step("pointsNotices", () => pointsExpiringNotices(now, over));
  await step("packageNotices", () => packageExpiringNotices(now, over));
  return out;
}

/**
 * A thank-you after a completed visit, followUpDelayHours after it
 * ended. Marketing: only to customers who opted in (lib/automations/send).
 */
async function followUps(now: Date, over: () => boolean = () => false): Promise<number> {
  const wall = cairoWallClock(now);
  const businesses = await allRows((after, take) => db.business.findMany({
    where: { followUpEnabled: true, isPublished: true, ...afterId(after) },
    select: { id: true, slug: true, nameAr: true, followUpDelayHours: true },
    orderBy: { id: "asc" },
    take,
  }));
  let n = 0;
  for (const biz of businesses) {
    if (over()) break;
    // Exactly this business's window: visits that ended between
    // (delay + 24h) and delay ago. A day wide, so an hourly or ten-minute
    // run sees each visit many times and the key sends it once.
    const latest = new Date(wall.getTime() - biz.followUpDelayHours * 3_600_000);
    const visits = await allRows((after, take) => db.booking.findMany({
      where: {
        businessId: biz.id, status: "COMPLETED", isTest: false, customerPhoneE164: { not: null },
        endsAt: { gte: new Date(latest.getTime() - DAY), lte: latest }, ...afterId(after),
      },
      select: { id: true, customerPhoneE164: true, serviceId: true, staffMemberId: true },
      orderBy: { id: "asc" },
      take,
    }));
    for (const b of visits) {
      if (over()) break;
      const r = await sendAutoMessage({
        key: `follow-up:${b.id}`,
        businessId: biz.id,
        bookingId: b.id,
        phoneE164: b.customerPhoneE164,
        title: `شكراً لزيارتك ${biz.nameAr}`,
        body: "نتمنى تكون الزيارة عجبتك. لو حابب تحجز تاني، ميعادك الجاي على بعد ضغطة.",
        href: rebookHref(biz.slug, b.serviceId, b.staffMemberId),
        marketing: true,
      }, now);
      if (r.some((o) => o.status === "SENT")) n++;
    }
  }
  return n;
}

/**
 * "Time for your next visit?" rebookAfterDays after the customer's last
 * completed visit, unless they already have one coming. Marketing.
 */
async function rebookNudges(now: Date, over: () => boolean = () => false): Promise<number> {
  const wall = cairoWallClock(now);
  const businesses = await allRows((after, take) => db.business.findMany({
    where: { rebookReminderEnabled: true, isPublished: true, ...afterId(after) },
    select: { id: true, slug: true, nameAr: true, rebookAfterDays: true },
    orderBy: { id: "asc" },
    take,
  }));
  let n = 0;
  for (const biz of businesses) {
    if (over()) break;
    const dayStart = new Date(wall.getTime() - biz.rebookAfterDays * DAY - DAY);
    const dayEnd = new Date(wall.getTime() - biz.rebookAfterDays * DAY);
    const visits = await allRows((after, take) => db.booking.findMany({
      where: { businessId: biz.id, status: "COMPLETED", isTest: false, customerPhoneE164: { not: null }, endsAt: { gte: dayStart, lt: dayEnd }, ...afterId(after) },
      select: { id: true, customerPhoneE164: true, serviceId: true, staffMemberId: true },
      orderBy: { id: "asc" },
      take,
    }));
    for (const v of visits) {
      if (over()) break;
      const phone = v.customerPhoneE164!;
      // Booked since, or one still to come (however long ago it was
      // made — a next visit booked at the end of this one): no nudge.
      const since = await db.booking.count({
        where: {
          businessId: biz.id, customerPhoneE164: phone, id: { not: v.id }, isTest: false,
          OR: [
            { createdAt: { gt: dayStart }, status: { notIn: ["CANCELLED", "FAILED_PAYMENT"] } },
            { startsAt: { gt: wall }, status: { in: ["PENDING_PAYMENT", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS"] } },
          ],
        },
      });
      if (since > 0) continue;
      const r = await sendAutoMessage({
        key: `rebook:${v.id}`,
        businessId: biz.id,
        bookingId: v.id,
        phoneE164: phone,
        title: `وقت زيارتك الجاية في ${biz.nameAr}؟`,
        body: "عدّى وقت من آخر زيارة. احجز ميعادك الجاي بنفس الخدمة.",
        href: rebookHref(biz.slug, v.serviceId, v.staffMemberId),
        marketing: true,
      }, now);
      if (r.some((o) => o.status === "SENT")) n++;
    }
  }
  return n;
}

/** A membership the customer holds runs out soon and is not renewed: transactional. */
async function renewalNotices(now: Date, over: () => boolean = () => false): Promise<number> {
  const rows = await allRows((after, take) => db.customerMembership.findMany({
    where: { status: "ACTIVE", cancelAtPeriodEnd: false, paidThrough: { gt: now, lte: new Date(now.getTime() + 14 * DAY) }, ...afterId(after) },
    orderBy: { id: "asc" },
    take,
    select: {
      id: true, phoneE164: true, paidThrough: true, businessId: true,
      plan: { select: { nameAr: true } },
      business: { select: { nameAr: true, membershipRenewalNoticeDays: true } },
    },
  }));
  let n = 0;
  for (const m of rows) {
    if (over()) break;
    if (!m.paidThrough) continue;
    if (m.paidThrough.getTime() - now.getTime() > m.business.membershipRenewalNoticeDays * DAY) continue;
    const r = await sendAutoMessage({
      key: `renewal:${m.id}:${m.paidThrough.toISOString().slice(0, 10)}`,
      businessId: m.businessId,
      phoneE164: m.phoneE164,
      title: `عضويتك في ${m.business.nameAr} قربت تخلص`,
      body: `${m.plan.nameAr} — سارية لحد ${m.paidThrough.toISOString().slice(0, 10)}. جدّدها عند ${m.business.nameAr} عشان زياراتك متتوقفش.`,
      href: "/account/wallet",
      marketing: false,
    }, now);
    if (r.some((o) => o.status === "SENT")) n++;
  }
  return n;
}

/** Points the customer holds expire within a week: one notice per account per week. */
async function pointsExpiringNotices(now: Date, over: () => boolean = () => false): Promise<number> {
  // Summed per account in the database, so every account with points
  // expiring is seen, not the accounts of the first page of lots.
  const due = { remaining: { gt: 0 }, expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY) } };
  const sums = await db.loyaltyEntry.groupBy({
    by: ["accountId"],
    where: due,
    _sum: { remaining: true },
    orderBy: { accountId: "asc" },
    take: MAX_ROWS,
  });
  const accounts = await db.loyaltyAccount.findMany({
    where: { id: { in: sums.map((x) => x.accountId) } },
    select: {
      id: true, phoneE164: true,
      program: { select: { nameAr: true, businessId: true, business: { select: { loyaltyNoticesEnabled: true } } } },
      // An organization program's message is filed under the brand the
      // customer last earned at.
      entries: { where: { kind: "EARN" }, select: { businessId: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const accountOf = new Map(accounts.map((a) => [a.id, a]));
  const byAccount = new Map<string, { phone: string; points: number; businessId: string | null; name: string; enabled: boolean }>();
  for (const x of sums) {
    if (over()) break;
    const a = accountOf.get(x.accountId);
    if (!a) continue;
    byAccount.set(x.accountId, {
      phone: a.phoneE164,
      points: x._sum.remaining ?? 0,
      businessId: a.program.businessId ?? a.entries[0]?.businessId ?? null,
      name: a.program.nameAr,
      enabled: a.program.business ? a.program.business.loyaltyNoticesEnabled : true,
    });
  }
  const week = Math.floor(now.getTime() / (7 * DAY));
  let n = 0;
  for (const [accountId, a] of byAccount) {
    if (over()) break;
    if (!a.enabled || !a.businessId) continue;
    const r = await sendAutoMessage({
      key: `points-expiring:${accountId}:${week}`,
      businessId: a.businessId,
      phoneE164: a.phone,
      title: `${a.points} نقطة هتنتهي قريب`,
      body: `نقاطك في ${a.name} هتنتهي خلال أسبوع. استخدمها في حجزك الجاي.`,
      href: "/account/wallet",
      marketing: false,
    }, now);
    if (r.some((o) => o.status === "SENT")) n++;
  }
  return n;
}

/** A package with sessions left expires within a week: transactional. */
async function packageExpiringNotices(now: Date, over: () => boolean = () => false): Promise<number> {
  const rows = await allRows((after, take) => db.customerPackage.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY) }, ...afterId(after) },
    orderBy: { id: "asc" },
    select: { id: true, phoneE164: true, businessId: true, sessionsTotal: true, sessionsUsed: true, expiresAt: true, plan: { select: { nameAr: true } }, business: { select: { nameAr: true } } },
    take,
  }));
  let n = 0;
  for (const p of rows) {
    if (over()) break;
    const left = p.sessionsTotal - p.sessionsUsed;
    if (left <= 0) continue;
    const r = await sendAutoMessage({
      key: `package-expiring:${p.id}`,
      businessId: p.businessId,
      phoneE164: p.phoneE164,
      title: `باقتك في ${p.business.nameAr} قربت تنتهي`,
      body: `${p.plan.nameAr}: فاضل ${left} جلسة لحد ${p.expiresAt!.toISOString().slice(0, 10)}. احجزها قبل ما تنتهي.`,
      href: "/account/wallet",
      marketing: false,
    }, now);
    if (r.some((o) => o.status === "SENT")) n++;
  }
  return n;
}
