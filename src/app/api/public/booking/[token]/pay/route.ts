import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { createPaymentSession } from "@/lib/services/paymob";
import { attachProviderOrder } from "@/lib/payments/ledger";
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
      },
    });
    if (!booking) return err("لم يتم العثور على هذا الحجز", 404, { code: "not-found" });

    if (booking.status !== "PENDING_PAYMENT" || !booking.depositAmount) {
      return err("الحجز ده مش مستني دفع", 409, { code: "not-awaiting-payment", status: booking.status });
    }

    const amountCents = Math.round(Number(booking.depositAmount) * 100);

    // One at a time per booking: a double tap or an app retry sending two
    // requests at once must not open two payable pages. The advisory lock
    // serialises them; the second sees the first's new PENDING row.
    const decision = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${booking.id}))`;
      // Re-read under the lock: the reaper's sweep for holds with no
      // payment takes the same lock, so either it released the booking
      // before this (and no payment is opened for a released slot) or it
      // will see the payment this inserts and leave the booking alone.
      const now = await tx.booking.findUnique({ where: { id: booking.id }, select: { status: true } });
      if (now?.status !== "PENDING_PAYMENT") return { refuse: "not-awaiting-payment" as const, status: now?.status ?? null };
      const last = await tx.payment.findFirst({
        where: { bookingId: booking.id, kind: "BOOKING_DEPOSIT" },
        orderBy: { createdAt: "desc" },
        select: { status: true, createdAt: true },
      });
      if (last?.status === "SUCCEEDED") return { refuse: "already-paid" as const };
      if (last?.status === "PENDING" && Date.now() - last.createdAt.getTime() < PAGE_LIFETIME_MS) {
        return { refuse: "payment-in-progress" as const, retryAt: new Date(last.createdAt.getTime() + PAGE_LIFETIME_MS) };
      }
      // Pages past their lifetime cannot be paid any more; closing them
      // keeps the ledger saying so, and leaves exactly one live page.
      await tx.payment.updateMany({
        where: { bookingId: booking.id, kind: "BOOKING_DEPOSIT", status: "PENDING" },
        data: { status: "ABANDONED", failureReason: "superseded by a new payment page" },
      });
      const payment = await tx.payment.create({
        data: {
          kind: "BOOKING_DEPOSIT",
          businessId: booking.businessId,
          bookingId: booking.id,
          amountCents,
          currency: booking.currency,
          provider: "PAYMOB",
          status: "PENDING",
        },
      });
      return { payment };
    });

    if ("refuse" in decision) {
      if (decision.refuse === "not-awaiting-payment") {
        return err("الحجز ده مش مستني دفع", 409, { code: "not-awaiting-payment", status: decision.status });
      }
      if (decision.refuse === "already-paid") return err("الدفع وصل خلاص، التأكيد جاي", 409, { code: "already-paid" });
      return err("في صفحة دفع لسه شغالة للحجز ده. كمّلها، أو استنى لحد ما تخلص صلاحيتها.", 409, {
        code: "payment-in-progress",
        retryAt: decision.retryAt?.toISOString() ?? null,
      });
    }
    const { payment } = decision;

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
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500, { code: "server-error" });
  }
}
