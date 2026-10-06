/**
 * POST /api/webhooks/paymob
 *
 * Handles two types of Paymob transaction callbacks:
 *   1. Booking deposit — identified by paymobOrderId on Booking
 *   2. Subscription upgrade — identified by subscriptionPaymobOrderId on Business
 *
 * Security: always verify HMAC before trusting payment data.
 *
 * Configure in Paymob dashboard:
 *   Settings → Transaction processed callback → https://your-domain/api/webhooks/paymob
 */

import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { verifyWebhookHmac, type PaymobTransactionObj } from "@/lib/services/paymob";
import { type Plan } from "@/lib/plans";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";

interface PaymobWebhookBody {
  type?: string;
  obj?:  PaymobTransactionObj;
  hmac?: string;
}

export async function POST(req: Request) {
  let body: PaymobWebhookBody;

  try {
    body = await req.json();
  } catch (e) {
    // A callback we cannot parse means a customer may have paid for a
    // booking that never got confirmed. That must leave a trace.
    log.error("paymob webhook: unparseable payload", e);
    return err("invalid JSON", 400);
  }

  if (body.type !== "TRANSACTION") {
    return Response.json({ received: true }, { status: 200 });
  }

  const obj  = body.obj;
  const hmac = body.hmac ?? new URL(req.url).searchParams.get("hmac") ?? "";

  if (!obj) return err("missing transaction object", 400);

  // ── 1. Verify HMAC ────────────────────────────────────────────────────────
  if (!verifyWebhookHmac(obj, hmac)) {
    log.warn("[paymob webhook] HMAC verification failed");
    return err("invalid signature", 403);
  }

  const paymobOrderId = String(obj.order.id);

  // ── 2. Try booking payment first ──────────────────────────────────────────
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

  if (booking) {
    return handleBookingPayment(booking, obj);
  }

  // ── 3. Try subscription payment ───────────────────────────────────────────
  const business = await db.business.findFirst({
    where:   { subscriptionPaymobOrderId: paymobOrderId },
    include: { owner: { select: { email: true, name: true } } },
  });

  if (business) {
    return handleSubscriptionPayment(business, obj);
  }

  // Unknown order — log and ack
  log.warn("paymob webhook: no booking or subscription for order", { paymobOrderId });
  return Response.json({ received: true }, { status: 200 });
}

// ─── Booking deposit handler ──────────────────────────────────────────────────

async function handleBookingPayment(
  booking: NonNullable<Awaited<ReturnType<typeof findBooking>>>,
  obj:     PaymobTransactionObj,
) {
  const terminalStatuses = ["CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "FAILED_PAYMENT"];
  if (terminalStatuses.includes(booking.status)) {
    return Response.json({ received: true, skipped: true }, { status: 200 });
  }

  if (obj.success && !obj.pending && !obj.error_occured) {
    const updated = await db.booking.update({
      where: { id: booking.id },
      data:  {
        status:              "CONFIRMED",
        paymobTransactionId: String(obj.id),
      },
    });

    // Paymob retries a webhook it did not hear a clean answer to, so
    // the transaction id goes into the event: a retry computes the same
    // deduplication key and the customer is not thanked twice for one
    // payment.
    void notify({
      type: "payment.received",
      bookingId: booking.id,
      amount: Number(updated.depositAmount ?? updated.totalPrice),
      transactionId: String(obj.id),
    });
    void notify({ type: "booking.confirmed", bookingId: booking.id });

  } else {
    await db.booking.update({
      where: { id: booking.id },
      data:  { status: "FAILED_PAYMENT" },
    });

    // Nobody was told about a failed payment before this. The customer
    // was left looking at a booking that quietly stopped existing.
    void notify({
      type: "payment.failed",
      bookingId: booking.id,
      // Paymob's payload has no message field; what it does tell us is
      // whether it errored or simply was not successful.
      reason: obj.error_occured ? "provider-error" : "declined",
    });
  }

  return Response.json({ received: true }, { status: 200 });
}

// ─── Subscription payment handler ─────────────────────────────────────────────

async function handleSubscriptionPayment(
  business: Awaited<ReturnType<typeof findBusiness>>,
  obj:      PaymobTransactionObj,
) {
  if (!business) return Response.json({ received: true }, { status: 200 });

  if (obj.success && !obj.pending && !obj.error_occured) {
    const plan = business.pendingPlan as Plan | null;
    if (!plan || plan === "FREE") {
      log.warn("paymob webhook: subscription payment with no pendingPlan", { businessId: business.id });
      return Response.json({ received: true }, { status: 200 });
    }

    // Activate subscription: 30-day period from now
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setDate(currentPeriodEnd.getDate() + 30);

    await db.business.update({
      where: { id: business.id },
      data:  {
        plan,
        subscriptionStatus:         "ACTIVE",
        currentPeriodEnd,
        pendingPlan:                null,
        subscriptionPaymobOrderId:  null,
        subscriptionReminderSentAt: null, // reset so reminder fires again next cycle
      },
    });

    log.info(
      `[paymob webhook] subscription activated: business=${business.id} plan=${plan} until=${currentPeriodEnd.toISOString()}`,
    );

    // The owner paid and heard nothing back from us before this.
    void notify({
      type: "subscription.renewed",
      businessId: business.id,
      until: currentPeriodEnd,
    });

    // ── Referral reward: add 30 free days to the referrer ────────────────────
    if (business.referredById && !business.referralRewardedAt) {
      try {
        const referrer = await db.business.findUnique({
          where:  { id: business.referredById },
          select: { id: true, currentPeriodEnd: true },
        });
        if (referrer) {
          const now  = new Date();
          const base = referrer.currentPeriodEnd && referrer.currentPeriodEnd > now
            ? referrer.currentPeriodEnd
            : now;
          const newEnd = new Date(base);
          newEnd.setDate(newEnd.getDate() + 30);

          await db.$transaction([
            db.business.update({
              where: { id: referrer.id },
              data:  { currentPeriodEnd: newEnd },
            }),
            db.business.update({
              where: { id: business.id },
              data:  { referralRewardedAt: now },
            }),
          ]);

          log.info(
            `[referral reward] referrer=${referrer.id} +30 days → ${newEnd.toISOString()}`,
          );
        }
      } catch (e) {
        // Non-fatal — log but don't fail the webhook response
        log.error("[referral reward]", e);
      }
    }
  } else {
    // Payment failed — clear pending plan
    await db.business.update({
      where: { id: business.id },
      data:  { pendingPlan: null, subscriptionPaymobOrderId: null },
    });
  }

  return Response.json({ received: true }, { status: 200 });
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

function findBooking(paymobOrderId: string) {
  return db.booking.findFirst({
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
}

function findBusiness(paymobOrderId: string) {
  return db.business.findFirst({
    where:  { subscriptionPaymobOrderId: paymobOrderId },
    select: {
      id:                        true,
      pendingPlan:               true,
      referredById:              true,
      referralRewardedAt:        true,
      owner:                     { select: { email: true, name: true } },
    },
  });
}
