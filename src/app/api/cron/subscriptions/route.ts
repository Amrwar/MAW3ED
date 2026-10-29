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
 * Security: always validates Authorization: Bearer <CRON_SECRET>. With
 * no secret set the job refuses to run rather than running for anybody
 * who asks.
 */

import { db } from "@/lib/db";
import { pruneRateLimits } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";
import { authorizeCron } from "@/lib/security/cron-auth";

export async function GET(req: Request) {
  const allowed = authorizeCron(req, "subscriptions");
  if (!allowed.ok) return allowed.response;

  const now     = new Date();

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

  log.info(`[subscriptions cron] ${overdueBusinesses.length} subscription(s) to expire`);

  for (const biz of overdueBusinesses) {
    try {
      // Conditional on what was read: a renewal paid between the query
      // above and here moved currentPeriodEnd forward, and that business
      // must not be downgraded the moment after it paid.
      const { count } = await db.business.updateMany({
        where: { id: biz.id, subscriptionStatus: "ACTIVE", currentPeriodEnd: { lt: now } },
        data:  { subscriptionStatus: "INACTIVE" },
      });
      if (count === 0) {
        log.info(`[subscriptions cron] – not expired after all (renewed meanwhile): ${biz.id}`);
        continue;
      }

      // The dispatcher still sends the same hand-written expiry email —
      // it also files the in-app copy, and records the send so a cron
      // that overlaps itself cannot post it twice.
      await notify({ type: "subscription.expired", businessId: biz.id });

      log.info(`[subscriptions cron] ✓ Expired: ${biz.id} (${biz.nameAr})`);
      expired++;
    } catch (e) {
      log.error(`[subscriptions cron] ✗ Failed to expire ${biz.id}:`, e);
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

  log.info(`[subscriptions cron] ${upcomingExpiryBusinesses.length} renewal reminder(s) to send`);

  for (const biz of upcomingExpiryBusinesses) {
    try {
      const expiryDate = biz.currentPeriodEnd!;
      const msLeft     = expiryDate.getTime() - now.getTime();
      const daysLeft   = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      await notify({ type: "subscription.renewalDue", businessId: biz.id, daysLeft });

      await db.business.update({
        where: { id: biz.id },
        data:  { subscriptionReminderSentAt: now },
      });

      log.info(`[subscriptions cron] ✓ Reminded: ${biz.id} (${biz.nameAr}), ${daysLeft} days left`);
      reminded++;
    } catch (e) {
      log.error(`[subscriptions cron] ✗ Failed to remind ${biz.id}:`, e);
      failed++;
    }
  }

  // Clearing expired rate-limit windows rides along here rather than
  // running on the hot path: a delete on every login would cost every
  // request to tidy a table that stays small anyway.
  let pruned = 0;
  try {
    pruned = await pruneRateLimits();
  } catch (e) {
    log.error("[subscriptions cron] rate-limit prune failed", e);
  }

  log.info(
    `[subscriptions cron] Complete — expired: ${expired}, reminded: ${reminded}, failed: ${failed}, rate-limit rows pruned: ${pruned}`,
  );

  return Response.json({ ok: true, expired, reminded, failed, pruned });
}
