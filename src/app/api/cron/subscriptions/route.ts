/**
 * GET /api/cron/subscriptions
 *
 * Daily cron job for subscription lifecycle management.
 * Invoked by Vercel Cron (see vercel.json).
 *
 * Two passes each run:
 *
 * 1. EXPIRY — businesses where subscriptionStatus=ACTIVE, plan≠FREE,
 *    and currentPeriodEnd < now:
 *    → set subscriptionStatus=INACTIVE (keeps plan field for history)
 *    → send "subscription expired" email to owner
 *
 * 2. RENEWAL REMINDER — businesses where subscriptionStatus=ACTIVE, plan≠FREE,
 *    currentPeriodEnd is 1–4 days away, and subscriptionReminderSentAt is null:
 *    → send "renew in X days" email to owner
 *    → stamp subscriptionReminderSentAt to prevent duplicate sends
 *
 * Security: validates Authorization: Bearer <CRON_SECRET> if set in env.
 */

import { db } from "@/lib/db";
import { PLAN_NAMES_AR, type Plan } from "@/lib/plans";
import {
  sendSubscriptionRenewalReminder,
  sendSubscriptionExpiredEmail,
} from "@/lib/services/email";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.maw3ed.net";

function authorize(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  return req.headers.get("Authorization") === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    console.warn("[subscriptions cron] Rejected unauthorized request");
    return new Response("Unauthorized", { status: 401 });
  }

  const now     = new Date();
  const renewUrl = `${SITE_URL}/dashboard/settings`;

  let expired = 0;
  let reminded = 0;
  let failed   = 0;

  // ── 1. Expire overdue subscriptions ──────────────────────────────────────────
  const overdueBusinesses = await db.business.findMany({
    where: {
      subscriptionStatus: "ACTIVE",
      plan:               { not: "FREE" },
      currentPeriodEnd:   { lt: now },
    },
    include: { owner: { select: { email: true } } },
  });

  console.log(`[subscriptions cron] ${overdueBusinesses.length} subscription(s) to expire`);

  for (const biz of overdueBusinesses) {
    try {
      await db.business.update({
        where: { id: biz.id },
        data:  { subscriptionStatus: "INACTIVE" },
      });

      if (biz.owner.email) {
        await sendSubscriptionExpiredEmail(biz.owner.email, {
          businessName: biz.nameAr,
          planName:     PLAN_NAMES_AR[biz.plan as Plan],
          renewUrl,
        });
      }

      console.log(`[subscriptions cron] ✓ Expired: ${biz.id} (${biz.nameAr})`);
      expired++;
    } catch (e) {
      console.error(`[subscriptions cron] ✗ Failed to expire ${biz.id}:`, e);
      failed++;
    }
  }

  // ── 2. Send renewal reminders (3 days before expiry) ─────────────────────────
  const reminderWindowStart = new Date(now);
  const reminderWindowEnd   = new Date(now);
  reminderWindowStart.setDate(reminderWindowStart.getDate() + 1); // >1 day away
  reminderWindowEnd.setDate(reminderWindowEnd.getDate() + 4);     // <4 days away

  const upcomingExpiryBusinesses = await db.business.findMany({
    where: {
      subscriptionStatus:        "ACTIVE",
      plan:                      { not: "FREE" },
      currentPeriodEnd:          { gte: reminderWindowStart, lte: reminderWindowEnd },
      subscriptionReminderSentAt: null,
    },
    include: { owner: { select: { email: true } } },
  });

  console.log(`[subscriptions cron] ${upcomingExpiryBusinesses.length} renewal reminder(s) to send`);

  for (const biz of upcomingExpiryBusinesses) {
    try {
      const expiryDate = biz.currentPeriodEnd!;
      const msLeft     = expiryDate.getTime() - now.getTime();
      const daysLeft   = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      if (biz.owner.email) {
        await sendSubscriptionRenewalReminder(biz.owner.email, {
          businessName: biz.nameAr,
          planName:     PLAN_NAMES_AR[biz.plan as Plan],
          expiryDate:   expiryDate.toISOString().split("T")[0],
          renewUrl,
          daysLeft,
        });
      }

      await db.business.update({
        where: { id: biz.id },
        data:  { subscriptionReminderSentAt: now },
      });

      console.log(`[subscriptions cron] ✓ Reminded: ${biz.id} (${biz.nameAr}), ${daysLeft} days left`);
      reminded++;
    } catch (e) {
      console.error(`[subscriptions cron] ✗ Failed to remind ${biz.id}:`, e);
      failed++;
    }
  }

  console.log(`[subscriptions cron] Complete — expired: ${expired}, reminded: ${reminded}, failed: ${failed}`);

  return Response.json({ ok: true, expired, reminded, failed });
}
