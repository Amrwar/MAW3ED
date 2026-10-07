import { db } from "@/lib/db";
import { businessAllows } from "@/lib/plans";
import { notify } from "@/lib/notifications";
import { log } from "@/lib/logger";

/**
 * GET /api/cron/reminders
 *
 * Runs hourly (see vercel.json) and sends three things:
 *
 *   - the reminder, `reminderLeadHours` before the appointment;
 *   - the shorter nudge, `startingSoonLeadMins` before it, for
 *     businesses that switched it on;
 *   - the review request, once the appointment is done.
 *
 * It used to run once a day and remind about "tomorrow", which meant a
 * business could not ask for three hours' notice or two days'. The lead
 * time is per business now, so the job has to wake up often enough to
 * honour the shortest one.
 *
 * Running hourly is only safe because sending twice is impossible: every
 * send claims a key in NotificationDelivery before it goes out, so an
 * appointment that sits inside its reminder window for several
 * consecutive runs is still reminded exactly once. The job does not
 * decide that — it just asks, and the dispatcher answers DUPLICATE.
 *
 * Security: Vercel attaches Authorization: Bearer <CRON_SECRET> to every
 * cron invocation; it is validated when the secret is set.
 */

/** How far ahead to look at all. Nothing may be scheduled further out. */
const MAX_LEAD_HOURS = 72;

/** How long after an appointment ends to ask for a review. */
const REVIEW_DELAY_HOURS = 3;
/** And how long before we stop asking. */
const REVIEW_WINDOW_HOURS = 72;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    if (req.headers.get("Authorization") !== `Bearer ${cronSecret}`) {
      log.warn("[Reminders] Rejected unauthorized request");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const now = new Date();
  const counts = { reminder: 0, startingSoon: 0, review: 0, skipped: 0, failed: 0 };

  /* ── Upcoming appointments ──────────────────────────────── */

  const horizon = new Date(now.getTime() + MAX_LEAD_HOURS * 3_600_000);
  const upcoming = await db.booking.findMany({
    where: {
      status: "CONFIRMED",
      startsAt: { gte: now, lte: horizon },
    },
    select: {
      id: true,
      startsAt: true,
      customerReminderSentAt: true,
      business: {
        select: {
          id: true,
          reminderEnabled: true,
          reminderLeadHours: true,
          startingSoonEnabled: true,
          startingSoonLeadMins: true,
          // Reminders are an entitlement, so the plan has to come with
          // the booking rather than be looked up per row.
          plan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      },
    },
  });

  log.info(`[Reminders] ${upcoming.length} upcoming booking(s) in the next ${MAX_LEAD_HOURS}h`);

  for (const b of upcoming) {
    if (!b.startsAt) continue;
    const minutesAway = (b.startsAt.getTime() - now.getTime()) / 60_000;
    const biz = b.business;

    // Asked once per booking, for both kinds of nudge below.
    const remindersAllowed = businessAllows(biz, "reminders");

    try {
      // The reminder, once the appointment is inside its lead window —
      // and only on a plan that includes them. The owner's own
      // reminderEnabled switch still has to be on; this is the ceiling
      // above it, not a replacement for it.
      if (remindersAllowed && biz.reminderEnabled && minutesAway <= biz.reminderLeadHours * 60) {
        const results = await notify({ type: "booking.reminder", bookingId: b.id });
        if (results.some((r) => r.status === "SENT")) {
          counts.reminder++;
          // Kept in step for the dashboard, which still reads it. The
          // ledger is what actually prevents a second send.
          await db.booking.update({
            where: { id: b.id },
            data: { customerReminderSentAt: new Date() },
          });
        } else {
          counts.skipped++;
        }
      }

      // The shorter nudge, for businesses that asked for one.
      // The same entitlement: a shorter nudge is still a reminder.
      if (remindersAllowed && biz.startingSoonEnabled && minutesAway <= biz.startingSoonLeadMins) {
        const results = await notify({ type: "booking.startingSoon", bookingId: b.id });
        if (results.some((r) => r.status === "SENT")) counts.startingSoon++;
      }
    } catch (e) {
      log.error(`[Reminders] ✗ ${b.id}`, e);
      counts.failed++;
    }
  }

  /* ── Finished appointments, not yet reviewed ────────────── */

  const reviewFrom = new Date(now.getTime() - REVIEW_WINDOW_HOURS * 3_600_000);
  const reviewTo = new Date(now.getTime() - REVIEW_DELAY_HOURS * 3_600_000);

  const finished = await db.booking.findMany({
    where: {
      status: "COMPLETED",
      endsAt: { gte: reviewFrom, lte: reviewTo },
      // Asking somebody to review something they already reviewed is
      // the fastest way to teach them to ignore us.
      review: null,
      business: { reviewRequestEnabled: true },
    },
    select: { id: true },
  });

  log.info(`[Reminders] ${finished.length} finished booking(s) to ask about`);

  for (const b of finished) {
    try {
      const results = await notify({ type: "review.requested", bookingId: b.id });
      if (results.some((r) => r.status === "SENT")) counts.review++;
    } catch (e) {
      log.error(`[Reminders] ✗ review request ${b.id}`, e);
      counts.failed++;
    }
  }

  log.info(`[Reminders] Complete — ${JSON.stringify(counts)}`);

  return Response.json({ ok: true, at: now.toISOString(), ...counts });
}
