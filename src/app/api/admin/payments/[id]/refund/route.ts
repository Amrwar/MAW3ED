import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { recordAudit } from "@/lib/admin/audit";
import { refundTransaction } from "@/lib/services/paymob";
import { formatCents } from "@/lib/payments/money";

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

    if (payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED") {
      return err("لا يمكن استرجاع دفعة لم تنجح", 409);
    }

    const remaining = payment.amountCents - payment.refundedCents;
    if (remaining <= 0) return err("تم استرجاع هذه الدفعة بالكامل", 409);

    const amount = parsed.data.amountCents ?? remaining;
    if (amount > remaining) {
      return err(`المبلغ أكبر من المتبقي (${formatCents(remaining, payment.currency)})`, 422);
    }

    // ── 1. Intent, before anything moves ────────────────────────────────────
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

    // ── 2. Ask the provider ─────────────────────────────────────────────────
    //
    // A payment taken at the counter has no provider to ask: the money
    // goes back the same way it came, by hand, and this records it.
    const outcome =
      payment.provider === "MANUAL"
        ? { ok: true as const, providerRefundId: undefined, error: undefined }
        : payment.providerTransactionId
          ? await refundTransaction(payment.providerTransactionId, amount)
          : { ok: false as const, providerRefundId: undefined, error: "no provider transaction id" };

    // ── 3. Settle the record ────────────────────────────────────────────────
    if (!outcome.ok) {
      await db.refund.update({
        where: { id: refund.id },
        data: { status: "FAILED", failureReason: outcome.error?.slice(0, 500) ?? "refused" },
      });
      log.error("[admin refund] provider refused", { paymentId: payment.id, error: outcome.error });
      return err("رفض مزوّد الدفع عملية الاسترجاع", 502);
    }

    const refundedTotal = payment.refundedCents + amount;

    await db.$transaction([
      db.refund.update({
        where: { id: refund.id },
        data: { status: "SUCCEEDED", providerRefundId: outcome.providerRefundId ?? null },
      }),
      db.payment.update({
        where: { id: payment.id },
        data: {
          refundedCents: refundedTotal,
          status: refundedTotal >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED",
        },
      }),
    ]);

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
    return err("حدث خطأ", 500);
  }
}
