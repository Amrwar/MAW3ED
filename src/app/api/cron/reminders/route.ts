import { db } from "@/lib/db";
import { sendCustomerReminderTemplate } from "@/lib/services/whatsapp";
import { sendBookingReminderToCustomer, type BookingEmailData } from "@/lib/services/email";
import type { BookingNotificationData } from "@/lib/services/whatsapp-messages";
import { bookingPageUrl } from "@/lib/url";

/**
 * GET /api/cron/reminders
 *
 * Invoked daily by Vercel Cron (see vercel.json).
 * Finds all CONFIRMED bookings for tomorrow, sends a WhatsApp + optional email
 * reminder to each customer, then stamps customerReminderSentAt to prevent
 * duplicate sends on the next run.
 *
 * Security: Vercel automatically sets CRON_SECRET and attaches
 *   Authorization: Bearer <CRON_SECRET>  to every cron invocation.
 *   If CRON_SECRET is present in env, the header is validated here.
 */
export async function GET(req: Request) {
  // ── Auth ─────────────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[Reminders] Rejected unauthorized request");
      return new Response("Unauthorized", { status: 401 });
    }
  }

  // ── Tomorrow's UTC date (midnight → midnight) ─────────────────
  // Bookings are stored as UTC midnight, so we query for exactly
  // the UTC date that corresponds to tomorrow.
  const now = new Date();
  const tomorrowUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const tomorrowLabel = tomorrowUTC.toISOString().split("T")[0];

  console.log(`[Reminders] Running for date: ${tomorrowLabel}`);

  // ── Fetch unreminded confirmed bookings for tomorrow ──────────
  const bookings = await db.booking.findMany({
    where: {
      date:                   tomorrowUTC,
      status:                 "CONFIRMED",
      customerReminderSentAt: null,           // skip already-reminded
    },
    select: {
      id:           true,
      accessToken:  true,
      customerName: true,
      customerPhone:true,
      date:         true,
      startTime:    true,
      endTime:      true,
      totalPrice:   true,
      currency:     true,
      notes:        true,
      business: { select: { nameAr: true } },
      service:  { select: { nameAr: true } },
      customer: { select: { email: true } },
    },
  });

  console.log(`[Reminders] ${bookings.length} booking(s) to remind`);

  let sent   = 0;
  let failed = 0;

  for (const booking of bookings) {
    try {
      const dateStr   = booking.date.toISOString().split("T")[0];
      const bookingUrl = booking.accessToken ? bookingPageUrl(booking.accessToken) : null;

      const notifData: BookingNotificationData = {
        businessName:  booking.business.nameAr,
        serviceName:   booking.service.nameAr,
        date:          dateStr,
        startTime:     booking.startTime,
        endTime:       booking.endTime ?? "",
        customerName:  booking.customerName,
        customerPhone: booking.customerPhone,
        totalPrice:    Number(booking.totalPrice),
        currency:      booking.currency,
      };

      // WhatsApp reminder (never throws — logs internally on failure)
      await sendCustomerReminderTemplate(booking.customerPhone, notifData);

      // Email reminder — only if customer has an email on file
      const customerEmail = booking.customer?.email;
      if (customerEmail) {
        const emailData: BookingEmailData = {
          ...notifData,
          notes:      booking.notes,
          bookingUrl,
        };
        await sendBookingReminderToCustomer(customerEmail, emailData);
      }

      // ── Stamp reminder timestamp to prevent duplicate sends ────
      await db.booking.update({
        where: { id: booking.id },
        data:  { customerReminderSentAt: new Date() },
      });

      console.log(
        `[Reminders] ✓ ${booking.id} — ${booking.customerName} (${booking.customerPhone})`,
      );
      sent++;
    } catch (e) {
      // DB update failing is the main risk here — WhatsApp/email never throw.
      // Log and continue so one failure doesn't abort remaining reminders.
      console.error(`[Reminders] ✗ Failed for booking ${booking.id}:`, e);
      failed++;
    }
  }

  console.log(`[Reminders] Complete — sent: ${sent}, failed: ${failed}`);

  return Response.json({
    ok:        true,
    date:      tomorrowLabel,
    processed: bookings.length,
    sent,
    failed,
  });
}
