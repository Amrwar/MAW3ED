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
const DAY = 86_400_000;

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
}

export async function runOperations(now: Date = new Date()): Promise<OperationsRun> {
  const out: OperationsRun = { failed: [] };
  const step = async <K extends keyof OperationsRun>(name: K, f: () => Promise<OperationsRun[K]>) => {
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
  await step("followUps", () => followUps(now));
  await step("rebooks", () => rebookNudges(now));
  await step("renewals", () => renewalNotices(now));
  await step("pointsNotices", () => pointsExpiringNotices(now));
  await step("packageNotices", () => packageExpiringNotices(now));
  await step("redriven", () => redriveAutomations(now));
  return out;
}

/**
 * A thank-you after a completed visit, followUpDelayHours after it
 * ended. Marketing: only to customers who opted in (lib/automations/send).
 */
async function followUps(now: Date): Promise<number> {
  const wall = cairoWallClock(now);
  const businesses = await db.business.findMany({
    where: { followUpEnabled: true, isPublished: true },
    select: { id: true, slug: true, nameAr: true, followUpDelayHours: true },
    take: BATCH,
  });
  let n = 0;
  for (const biz of businesses) {
    // Exactly this business's window: visits that ended between
    // (delay + 24h) and delay ago. A day wide, so an hourly or ten-minute
    // run sees each visit many times and the key sends it once.
    const latest = new Date(wall.getTime() - biz.followUpDelayHours * 3_600_000);
    const visits = await db.booking.findMany({
      where: {
        businessId: biz.id, status: "COMPLETED", isTest: false, customerPhoneE164: { not: null },
        endsAt: { gte: new Date(latest.getTime() - DAY), lte: latest },
      },
      select: { id: true, customerPhoneE164: true, serviceId: true, staffMemberId: true },
      take: 100,
    });
    for (const b of visits) {
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
async function rebookNudges(now: Date): Promise<number> {
  const wall = cairoWallClock(now);
  const businesses = await db.business.findMany({
    where: { rebookReminderEnabled: true, isPublished: true },
    select: { id: true, slug: true, nameAr: true, rebookAfterDays: true },
    take: BATCH,
  });
  let n = 0;
  for (const biz of businesses) {
    const dayStart = new Date(wall.getTime() - biz.rebookAfterDays * DAY - DAY);
    const dayEnd = new Date(wall.getTime() - biz.rebookAfterDays * DAY);
    const visits = await db.booking.findMany({
      where: { businessId: biz.id, status: "COMPLETED", isTest: false, customerPhoneE164: { not: null }, endsAt: { gte: dayStart, lt: dayEnd } },
      select: { id: true, customerPhoneE164: true, serviceId: true, staffMemberId: true },
      take: 50,
    });
    for (const v of visits) {
      const phone = v.customerPhoneE164!;
      // Booked since, or coming: no nudge.
      const since = await db.booking.count({
        where: { businessId: biz.id, customerPhoneE164: phone, id: { not: v.id }, createdAt: { gt: dayStart }, status: { notIn: ["CANCELLED", "FAILED_PAYMENT"] } },
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
async function renewalNotices(now: Date): Promise<number> {
  const rows = await db.customerMembership.findMany({
    where: { status: "ACTIVE", cancelAtPeriodEnd: false, paidThrough: { gt: now, lte: new Date(now.getTime() + 14 * DAY) } },
    select: {
      id: true, phoneE164: true, paidThrough: true, businessId: true,
      plan: { select: { nameAr: true } },
      business: { select: { nameAr: true, membershipRenewalNoticeDays: true } },
    },
    take: BATCH,
  });
  let n = 0;
  for (const m of rows) {
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
async function pointsExpiringNotices(now: Date): Promise<number> {
  const lots = await db.loyaltyEntry.findMany({
    where: { remaining: { gt: 0 }, expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY) } },
    select: {
      accountId: true, remaining: true, businessId: true,
      account: { select: { phoneE164: true } },
      program: { select: { nameAr: true, businessId: true, business: { select: { loyaltyNoticesEnabled: true } } } },
    },
    take: BATCH,
  });
  const byAccount = new Map<string, { phone: string; points: number; businessId: string | null; name: string; enabled: boolean }>();
  for (const l of lots) {
    const a = byAccount.get(l.accountId) ?? {
      phone: l.account.phoneE164,
      points: 0,
      businessId: l.program.businessId ?? l.businessId,
      name: l.program.nameAr,
      enabled: l.program.business ? l.program.business.loyaltyNoticesEnabled : true,
    };
    a.points += l.remaining ?? 0;
    byAccount.set(l.accountId, a);
  }
  const week = Math.floor(now.getTime() / (7 * DAY));
  let n = 0;
  for (const [accountId, a] of byAccount) {
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
async function packageExpiringNotices(now: Date): Promise<number> {
  const rows = await db.customerPackage.findMany({
    where: { status: "ACTIVE", expiresAt: { gt: now, lte: new Date(now.getTime() + 7 * DAY) } },
    select: { id: true, phoneE164: true, businessId: true, sessionsTotal: true, sessionsUsed: true, expiresAt: true, plan: { select: { nameAr: true } }, business: { select: { nameAr: true } } },
    take: BATCH,
  });
  let n = 0;
  for (const p of rows) {
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
