import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { createPaymentSession } from "@/lib/services/paymob";
import {
  attachProviderOrder,
  openPayment,
  paidCentsForBooking,
  recordManualPayment,
} from "@/lib/payments/ledger";
import { balanceCents, formatCents, toCents } from "@/lib/payments/money";
import { inBookingQueueOrDirect } from "@/lib/bookings/queue";
import { canUseFeature, getEffectivePlan } from "@/lib/plans";
import { notifyLater } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

const schema = z
  .object({
    /**
     * "link" opens a Paymob session the owner sends to the customer.
     * "manual" records money that changed hands at the counter.
     */
    mode: z.enum(["link", "manual"]),
    method: z.enum(["CASH", "CARD", "OTHER"]).optional(),
    /** Piastres. Defaults to whatever is still owed. */
    amountCents: z.number().int().positive().optional(),
  })
  .refine((v) => v.mode !== "manual" || !!v.method, {
    message: "طريقة الدفع مطلوبة",
    path: ["method"],
  });

/**
 * GET /api/business/bookings/[id]/payments
 *
 * What has been collected against this booking and what is left. The
 * owner's view of one booking's money.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const booking = await db.booking.findFirst({
      where: { id, businessId: business.id },
      select: { id: true, totalPrice: true, currency: true },
    });
    if (!booking) return err("الحجز غير موجود", 404);

    const payments = await db.payment.findMany({
      where: { bookingId: booking.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kind: true,
        status: true,
        provider: true,
        method: true,
        amountCents: true,
        refundedCents: true,
        receiptNumber: true,
        paidAt: true,
        failureReason: true,
        createdAt: true,
      },
    });

    const paid = await paidCentsForBooking(booking.id);
    const total = toCents(booking.totalPrice);

    return ok({
      totalCents: total,
      paidCents: paid,
      outstandingCents: balanceCents(booking.totalPrice, paid),
      currency: booking.currency,
      payments: payments.map((p) => ({ ...p, paidAt: p.paidAt?.toISOString() ?? null })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[booking payments GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/**
 * POST /api/business/bookings/[id]/payments
 *
 * Collect what is still owed, either by sending the customer a payment
 * link or by recording that they paid in person.
 *
 * The amount is computed here from the booking's price and what the
 * ledger says has already been collected. A caller may ask for less
 * than the outstanding balance — part payments happen — but never for
 * more, and never for a booking that is already settled.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { session, business } = await requireBusiness();
    const { id } = await params;

    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? "طلب غير صالح", 422);
    }
    const { mode, method, amountCents } = parsed.data;

    const effectivePlan = getEffectivePlan(
      business.plan,
      business.subscriptionStatus,
      business.trialEndsAt,
    );

    const booking = await db.booking.findFirst({
      where: { id, businessId: business.id },
      select: {
        id: true,
        status: true,
        totalPrice: true,
        depositAmount: true,
        currency: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        isTest: true,
      },
    });
    if (!booking) return err("الحجز غير موجود", 404);
    // A test booking is deleted when the page is published; money
    // recorded against it would be left pointing at nothing.
    if (booking.isTest) return err("ده حجز تجريبي — مفيش دفع عليه", 409, { code: "test-booking" });

    if (booking.status === "CANCELLED") {
      return err("الحجز ملغي", 409);
    }
    // Its slot has been released — maybe already taken by somebody else
    // — so money cannot be taken against it any more.
    if (booking.status === "FAILED_PAYMENT") {
      return err("الحجز ده اتلغى لأن الدفع ما اكتملش، اعمل حجز جديد", 409, { code: "payment-failed" });
    }

    const paid = await paidCentsForBooking(booking.id);
    const outstanding = balanceCents(booking.totalPrice, paid);

    if (outstanding === 0) {
      return err("الحجز مدفوع بالكامل", 409);
    }

    const amount = amountCents ?? outstanding;
    if (amount > outstanding) {
      return err(
        `المبلغ أكبر من المتبقي (${formatCents(outstanding, booking.currency)})`,
        422,
      );
    }

    // ── Money taken at the counter ──────────────────────────────────────────
    //
    // No provider to hear back from: the owner saying it happened is
    // the whole of the evidence, which is why the row carries who they
    // are. Allowed on any plan — recording cash is bookkeeping, not a
    // payment feature we are providing.
    if (mode === "manual") {
      // The balance check above is for a quick, friendly answer; the one
      // that decides is repeated inside recordManualPayment under a row
      // lock, because two recordings racing would both pass this one.
      const recorded = await recordManualPayment({
        businessId: business.id,
        bookingId: booking.id,
        totalCents: toCents(booking.totalPrice),
        amountCents: amount,
        method: method!,
        recordedById: session.user.id,
        currency: booking.currency,
        holdCents: toCents(booking.depositAmount ?? booking.totalPrice),
      });
      if (!recorded.ok) {
        if (recorded.closed) {
          return err("الحجز ده اتلغى أو اتفك حجزه، اعمل حجز جديد", 409, { code: "payment-failed" });
        }
        if (recorded.belowDepositCents !== undefined) {
          return err(
            `الحجز مستني العربون؛ سجّل ${formatCents(recorded.belowDepositCents, booking.currency)} على الأقل عشان يتثبّت`,
            422,
            { code: "below-deposit", minimumCents: recorded.belowDepositCents },
          );
        }
        return recorded.outstandingCents === 0
          ? err("الحجز مدفوع بالكامل", 409)
          : err(
              `المبلغ أكبر من المتبقي (${formatCents(recorded.outstandingCents, booking.currency)})`,
              422,
            );
      }

      await advanceAfterManualPayment(booking.id, session.user.id);

      return ok({
        paymentId: recorded.payment.id,
        receiptNumber: recorded.payment.receiptNumber,
        outstandingCents: balanceCents(booking.totalPrice, recorded.paidBeforeCents + amount),
      });
    }

    // ── A link for the customer ─────────────────────────────────────────────
    //
    // This one goes through Paymob, so it needs the plan that includes
    // taking payments.
    if (!canUseFeature(effectivePlan, "deposits")) {
      return err("إرسال رابط دفع متاح في الخطط المدفوعة", 403);
    }

    const payment = await openPayment({
      kind: paid === 0 ? "BOOKING_FULL" : "BOOKING_BALANCE",
      businessId: business.id,
      bookingId: booking.id,
      amountCents: amount,
      currency: booking.currency,
    });

    try {
      const { paymentUrl, paymobOrderId } = await createPaymentSession({
        bookingId: booking.id,
        amountCents: amount,
        currency: booking.currency,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customerEmail ?? undefined,
      });

      await attachProviderOrder(payment.id, paymobOrderId);

      return ok({ paymentId: payment.id, paymentUrl, amountCents: amount });
    } catch (sessionError) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "could not open a Paymob session" },
      });
      log.error("[booking payments POST] Paymob session failed", sessionError);
      return err("تعذّر إنشاء رابط الدفع، حاول مرة أخرى", 502);
    }
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[booking payments POST]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/**
 * Money taken at the counter that covers what the booking was waiting
 * for — its deposit, or the whole price when it had none — moves a
 * PENDING_PAYMENT booking on, exactly as the deposit arriving online
 * would have: to CONFIRMED, or to PENDING when the business reviews
 * bookings itself (autoConfirm off). Without this an owner who took the
 * deposit in cash had a booking they could neither confirm nor keep.
 *
 * Any payment link still open for it is closed (ABANDONED), so the
 * customer is not asked to pay the deposit twice. If they pay through
 * it anyway, the webhook still records the money and flags it for a
 * refund (payment.unexpected_deposit).
 *
 * Only ever moves a booking forward, and never out of a state a person
 * put it in.
 */
async function advanceAfterManualPayment(bookingId: string, actorUserId: string): Promise<void> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      status: true,
      businessId: true,
      totalPrice: true,
      depositAmount: true,
      business: { select: { autoConfirm: true } },
    },
  });
  if (booking?.status !== "PENDING_PAYMENT") return;

  const paid = await paidCentsForBooking(bookingId);
  if (paid < toCents(booking.depositAmount ?? booking.totalPrice)) return;

  const next = booking.business.autoConfirm ? "CONFIRMED" : "PENDING";
  // In the business's booking queue (lib/bookings/queue.ts): the new
  // status is a new row version the overlap constraints check again.
  // The payment is already recorded and nothing will retry this step,
  // so a busy queue does not stop it: the write is then made directly
  // (lib/bookings/queue.ts).
  const moved = await inBookingQueueOrDirect(booking.businessId, (tx) =>
    tx.booking.updateMany({
      where: { id: bookingId, status: "PENDING_PAYMENT" },
      data: { status: next },
    }),
  );
  if (moved.count === 0) return;

  await db.payment.updateMany({
    where: { bookingId, status: "PENDING", provider: "PAYMOB" },
    data: { status: "ABANDONED", failureReason: "superseded: paid at the venue" },
  });

  // The booking has only now become real, so this is when the rest of
  // the business hears about it (the owner who recorded it is the
  // actor and is not told). Confirmed: the customer gets the
  // confirmation; awaiting review: they get the "received" message.
  if (next === "CONFIRMED") {
    notifyLater({ type: "booking.created", bookingId, only: "business", actorUserId });
    notifyLater({ type: "booking.confirmed", bookingId, actorUserId });
  } else {
    notifyLater({ type: "booking.created", bookingId, actorUserId });
  }
}
