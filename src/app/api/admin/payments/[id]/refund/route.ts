import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { refundTransaction } from "@/lib/services/paymob";
import { formatCents } from "@/lib/payments/money";
import {
  reserveRefund,
  releaseRefundReservation,
  markRefundOutcome,
} from "@/lib/payments/ledger";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  /** Piastres. Omitted means the whole of what is left. */
  amountCents: z.number().int().positive().optional(),
  reason: z.string().trim().min(3).max(500),
});

/**
 * POST /api/admin/payments/[id]/refund
 *
 * Send money back.
 *
 * Super admin only, by permission rather than by role name, and never
 * the business itself — a refund moves money out and wants a second
 * pair of eyes. The owner asks; this is where it is granted.
 *
 * The order of operations is the whole point:
 *
 *   1. A PENDING refund row is written first. If the process dies
 *      between here and Paymob, there is a record that somebody tried,
 *      rather than money possibly moved and nothing to show for it.
 *   2. Paymob is called.
 *   3. The row is settled either way, and only a success touches the
 *      payment's refunded total.
 *
 * Partial refunds are allowed and can be repeated up to the amount
 * taken; the database refuses to let the total exceed it.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const admin = await requireAdminApi("payments.refund");
    if (!admin) return adminNotFound();

    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? "طلب غير صالح", 422);
    }
    const { reason } = parsed.data;

    const payment = await db.payment.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        provider: true,
        amountCents: true,
        refundedCents: true,
        currency: true,
        providerTransactionId: true,
        businessId: true,
        bookingId: true,
        receiptNumber: true,
      },
    });
    if (!payment) return err("الدفعة غير موجودة", 404);

    const amount =
      parsed.data.amountCents ?? payment.amountCents - payment.refundedCents;

    // ── 1. Reserve, before the provider is asked ──
    //
    // Eligibility is decided inside one conditional UPDATE rather than
    // read first and acted on after. Read-then-write let two requests
    // arriving together — two admins, or one impatient double-click —
    // both pass the check, both send a real refund to Paymob, and both
    // write the same total: the money goes back twice and the ledger
    // records it once.
    const reservation = await reserveRefund(payment.id, amount);
    if (!reservation.ok) {
      const detail =
        reservation.reason === "المبلغ أكبر من المتبقي"
          ? `${reservation.reason} (${formatCents(reservation.remainingCents, payment.currency)})`
          : reservation.reason;
      return err(detail ?? "تعذّر الاسترجاع", 409);
    }

    // ── 2. Intent, now that the amount is held ────────────────────────────────────
    const refund = await db.refund.create({
      data: {
        paymentId: payment.id,
        amountCents: amount,
        reason,
        actorId: admin.id,
        actorName: admin.name ?? "مشرف",
        status: "PENDING",
      },
    });

    // ── 3. Ask the provider ─────────────────────────────────────────────────
    //
    // A payment taken at the counter has no provider to ask: the money
    // goes back the same way it came, by hand, and this records it.
    const outcome =
      payment.provider === "MANUAL"
        ? { ok: true as const, providerRefundId: undefined, error: undefined }
        : payment.providerTransactionId
          ? await refundTransaction(payment.providerTransactionId, amount)
          : { ok: false as const, providerRefundId: undefined, error: "no provider transaction id" };

    // ── 4. Settle the record ──
    if (!outcome.ok && outcome.uncertain) {
      // The provider may have sent the money: a timeout or a 5xx says
      // nothing either way. Releasing the reservation here would let a
      // retry send it again, so the amount stays held and the row stays
      // PENDING until Paymob's own callback for the refund arrives
      // (webhooks/paymob reconcileReversal attaches it) or somebody
      // checks the Paymob dashboard and settles it by hand
      // (docs/runbooks/PAYMENT_OPERATIONS.md).
      await db.refund.update({
        where: { id: refund.id },
        data: { failureReason: `uncertain: ${outcome.error?.slice(0, 480) ?? "no answer"}` },
      });
      log.error("[admin refund] provider outcome unknown; reservation kept", {
        paymentId: payment.id,
        refundId: refund.id,
        amountCents: amount,
        error: outcome.error,
      });
      return err("مزوّد الدفع مردّش. الاسترجاع متعلّق لحد ما يتأكد — متكرّرش الطلب.", 502, {
        code: "refund-uncertain",
        refundId: refund.id,
      });
    }

    if (!outcome.ok) {
      // Hand the reservation back: no money moved, so the headroom
      // must not stay held against a later legitimate refund.
      await releaseRefundReservation(payment.id, amount);
      await db.refund.update({
        where: { id: refund.id },
        data: { status: "FAILED", failureReason: outcome.error?.slice(0, 500) ?? "رفض" },
      });
      log.error("[admin refund] provider refused", {
        paymentId: payment.id,
        refundId: refund.id,
        amountCents: amount,
        error: outcome.error,
      });
      return err("رفض مزوّد الدفع عملية الاسترجاع", 502);
    }

    // refundedCents already moved when the amount was reserved, so this
    // only brings `status` into line with it.
    const refundedTotal = payment.refundedCents + amount;

    await db.refund.update({
      where: { id: refund.id },
      // Never clears an id: Paymob's refund callback may have attached it
      // already (webhooks/paymob reconcileReversal), and the answer here
      // does not always carry one.
      data: {
        status: "SUCCEEDED",
        ...(outcome.providerRefundId ? { providerRefundId: outcome.providerRefundId } : {}),
      },
    });
    await markRefundOutcome(payment.id);

    await recordAudit({
      actor: admin,
      action: "payment.refund",
      resourceType: "payment",
      resourceId: payment.id,
      summary: `${admin.name ?? "مشرف"} استرجع ${formatCents(amount, payment.currency)} من دفعة ${payment.receiptNumber ?? payment.id}`,
      metadata: {
        amountCents: amount,
        refundedTotal,
        businessId: payment.businessId,
        bookingId: payment.bookingId,
        provider: payment.provider,
        providerRefundId: outcome.providerRefundId ?? null,
        reason,
      },
    });

    return ok({
      refundId: refund.id,
      amountCents: amount,
      refundedCents: refundedTotal,
      status: refundedTotal >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED",
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[admin refund]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
