/**
 * POST /api/webhooks/paymob
 *
 * Receives Paymob transaction processed callbacks.
 * Paymob sends a JSON body with:
 *   { type: "TRANSACTION", obj: { ...transaction }, hmac: "..." }
 *
 * Security:
 *  - Always verify the HMAC before trusting any payment data.
 *  - Never confirm a booking based on query params alone.
 *  - The hmac may arrive as a query param OR in the body — we check both.
 *
 * Configure this URL in Paymob dashboard:
 *   Settings → Webhook endpoints → https://your-domain/api/webhooks/paymob
 */

import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { verifyWebhookHmac, type PaymobTransactionObj } from "@/lib/services/paymob";
import { bookingPageUrl } from "@/lib/url";
import {
  sendBusinessBookingTemplate,
  sendCustomerConfirmationTemplate,
} from "@/lib/services/whatsapp";
import type { BookingNotificationData } from "@/lib/services/whatsapp-messages";
import {
  sendBookingConfirmationToCustomer,
  sendNewBookingAlertToBusiness,
  type BookingEmailData,
} from "@/lib/services/email";

interface PaymobWebhookBody {
  type?: string;
  obj?:  PaymobTransactionObj;
  hmac?: string;
}

export async function POST(req: Request) {
  let body: PaymobWebhookBody;

  try {
    body = await req.json();
  } catch {
    return err("invalid JSON", 400);
  }

  // Only handle TRANSACTION type events
  if (body.type !== "TRANSACTION") {
    return Response.json({ received: true }, { status: 200 });
  }

  const obj  = body.obj;
  const hmac = body.hmac ?? new URL(req.url).searchParams.get("hmac") ?? "";

  if (!obj) return err("missing transaction object", 400);

  // ── 1. Verify HMAC signature ───────────────────────────────────────────────
  if (!verifyWebhookHmac(obj, hmac)) {
    console.warn("[paymob webhook] HMAC verification failed — possible forgery");
    return err("invalid signature", 403);
  }

  const paymobOrderId = String(obj.order.id);

  // ── 2. Find the booking linked to this Paymob order ───────────────────────
  const booking = await db.booking.findFirst({
    where:   { paymobOrderId },
    include: {
      business: {
        select: {
          nameAr:   true,
          whatsapp: true,
          phone:    true,
          owner:    { select: { email: true } },
        },
      },
      service: { select: { nameAr: true } },
    },
  });

  if (!booking) {
    // Could be a legitimate order from a different system; log and ack
    console.warn("[paymob webhook] no booking for order", paymobOrderId);
    return Response.json({ received: true }, { status: 200 });
  }

  // ── 3. Idempotency — skip if already in a terminal state ─────────────────
  const terminalStatuses = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "FAILED_PAYMENT"];
  if (terminalStatuses.includes(booking.status)) {
    return Response.json({ received: true, skipped: true }, { status: 200 });
  }

  // ── 4. Update booking based on transaction result ─────────────────────────
  if (obj.success && !obj.pending && !obj.error_occured) {
    // Payment successful — confirm the booking
    const updated = await db.booking.update({
      where: { id: booking.id },
      data:  {
        status:               "CONFIRMED",
        paymobTransactionId:  String(obj.id),
      },
    });

    // ── 5. Send confirmation notifications ──────────────────────────────────
    const bookingUrl    = bookingPageUrl(booking.accessToken ?? "");
    const bookingDate   = updated.date.toISOString().split("T")[0];

    const notifData: BookingNotificationData = {
      businessName:  booking.business.nameAr,
      serviceName:   booking.service.nameAr,
      date:          bookingDate,
      startTime:     updated.startTime,
      endTime:       updated.endTime ?? "",
      customerName:  updated.customerName,
      customerPhone: updated.customerPhone,
      totalPrice:    Number(updated.totalPrice),
      currency:      updated.currency,
      bookingUrl,
    };

    const businessPhone = booking.business.whatsapp ?? booking.business.phone;
    if (businessPhone) void sendBusinessBookingTemplate(businessPhone, notifData);
    void sendCustomerConfirmationTemplate(updated.customerPhone, notifData);

    const emailData: BookingEmailData = {
      businessName:  booking.business.nameAr,
      serviceName:   booking.service.nameAr,
      date:          bookingDate,
      startTime:     updated.startTime,
      endTime:       updated.endTime ?? "",
      customerName:  updated.customerName,
      customerPhone: updated.customerPhone,
      totalPrice:    Number(updated.totalPrice),
      currency:      updated.currency,
      notes:         updated.notes,
      bookingUrl,
    };

    if (booking.business.owner.email) {
      void sendNewBookingAlertToBusiness(booking.business.owner.email, emailData);
    }
    // Customer email: we don't store it on the booking — skip unless you add it
  } else {
    // Payment failed or pending
    await db.booking.update({
      where: { id: booking.id },
      data:  { status: "FAILED_PAYMENT" },
    });
  }

  return Response.json({ received: true }, { status: 200 });
}
