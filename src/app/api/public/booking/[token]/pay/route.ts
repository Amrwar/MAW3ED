import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { createPaymentSession } from "@/lib/services/paymob";
import { attachProviderOrder, openPayment } from "@/lib/payments/ledger";
import { log } from "@/lib/logger";

/**
 * POST /api/public/booking/[token]/pay
 *
 * A fresh payment page for a booking still holding its time while it
 * waits for its deposit — for a customer who closed the app mid-payment
 * and lost the page, or whose page expired.
 *
 * The rule that matters is not charging twice. Paymob's page stays
 * payable for an hour (the payment key's expiration). While an earlier
 * page could still be completed — a PENDING payment younger than that —
 * a second one is refused, because both could be paid. After it, the old
 * page is dead and a new order is safe. A payment that already landed
 * means there is nothing to pay; the webhook confirms the booking.
 *
 * The amount is the booking's own deposit, from the database; the
 * request carries nothing but the token.
 */

/** Paymob's payment key lifetime (lib/services/paymob.ts, expiration: 3600), plus a margin. */
const PAGE_LIFETIME_MS = 65 * 60 * 1000;

export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) return err("رابط غير صالح", 400, { code: "invalid" });

    const booking = await db.booking.findUnique({
      where: { accessToken: token },
      select: {
        id: true,
        status: true,
        businessId: true,
        depositAmount: true,
        currency: true,
        customerName: true,
        customerPhone: true,
        customer: { select: { email: true } },
        payments: {
          where: { kind: "BOOKING_DEPOSIT" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, createdAt: true },
        },
      },
    });
    if (!booking) return err("لم يتم العثور على هذا الحجز", 404, { code: "not-found" });

    if (booking.status !== "PENDING_PAYMENT" || !booking.depositAmount) {
      return err("الحجز ده مش مستني دفع", 409, { code: "not-awaiting-payment", status: booking.status });
    }

    const last = booking.payments[0];
    if (last?.status === "SUCCEEDED") {
      return err("الدفع وصل خلاص، التأكيد جاي", 409, { code: "already-paid" });
    }
    if (last?.status === "PENDING" && Date.now() - last.createdAt.getTime() < PAGE_LIFETIME_MS) {
      const retryAt = new Date(last.createdAt.getTime() + PAGE_LIFETIME_MS).toISOString();
      return err("في صفحة دفع لسه شغالة للحجز ده. كمّلها، أو استنى لحد ما تخلص صلاحيتها.", 409, {
        code: "payment-in-progress",
        retryAt,
      });
    }

    const amountCents = Math.round(Number(booking.depositAmount) * 100);
    const payment = await openPayment({
      kind: "BOOKING_DEPOSIT",
      businessId: booking.businessId,
      bookingId: booking.id,
      amountCents,
      currency: booking.currency,
    });

    try {
      const { paymentUrl, paymobOrderId } = await createPaymentSession({
        bookingId: booking.id,
        amountCents,
        currency: booking.currency,
        customerName: booking.customerName,
        customerPhone: booking.customerPhone,
        customerEmail: booking.customer?.email ?? undefined,
      });
      await attachProviderOrder(payment.id, paymobOrderId);
      await db.booking.update({ where: { id: booking.id }, data: { paymobOrderId } });
      return ok({ paymentUrl }, 201);
    } catch (e) {
      // Nothing was opened at Paymob, so nothing can be paid: the ledger
      // row is closed as failed and the booking keeps waiting.
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "FAILED", failureReason: "could not open a Paymob session (retry)" },
      });
      log.error("[booking pay] Paymob session failed", e instanceof Error ? { message: e.message } : undefined);
      return err("تعذّر بدء عملية الدفع، حاول مرة أخرى", 502, { code: "payment-unavailable" });
    }
  } catch (e) {
    log.error("[booking pay]", e instanceof Error ? { message: e.message } : undefined);
    return err("حدث خطأ", 500, { code: "server-error" });
  }
}
