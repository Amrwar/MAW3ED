import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { diagnosePaymob } from "@/lib/services/paymob";
import { arCount } from "@/lib/fmt";

/**
 * GET /api/admin/payments/diagnostics
 *
 * Why payments are not working.
 *
 * Three real subscription attempts have failed with "provider-error"
 * and nothing recorded what the gateway actually said, so there was no
 * way to tell a misconfigured integration from a declined card. The
 * two need completely different responses: one is a setting to change,
 * the other is somebody's bank.
 *
 * This answers the half that does not need a card. It authenticates
 * against Paymob and stops — no order, no payment key, no charge — and
 * reports that alongside what the ledger has actually seen.
 *
 * Super admin only, and it returns no secret: the API key is used and
 * never reported, while the integration and iframe ids are identifiers
 * printed in the Paymob dashboard, which is exactly what somebody needs
 * in order to compare the two.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdminApi("payments.read");
    if (!admin) return adminNotFound();

    const [paymob, counts, recentFailures] = await Promise.all([
      diagnosePaymob(),
      db.payment.groupBy({ by: ["status"], _count: { _all: true } }),
      db.payment.findMany({
        where: { status: { in: ["FAILED", "ABANDONED"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          kind: true,
          status: true,
          amountCents: true,
          currency: true,
          failureReason: true,
          createdAt: true,
        },
      }),
    ]);

    const byStatus = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));
    const succeeded = byStatus.SUCCEEDED ?? 0;

    // Paymob distinguishes two kinds of failure and they lead opposite
    // ways. A plain decline is success:false with error_occured:false —
    // the bank refused, nothing here is wrong. error_occured:true means
    // the transaction errored while being processed, which points at
    // the integration or the 3-D Secure step rather than at the card.
    //
    // Worth separating, because "credentials authenticate" is true in
    // both cases and says nothing about which one you are in. An
    // earlier version of this endpoint read every failure as a decline
    // and sent somebody looking at their card when the evidence
    // pointed at configuration.
    const providerErrors = recentFailures.filter(
      (f) => f.failureReason?.startsWith("provider-error") ?? false,
    ).length;
    const declines = recentFailures.filter(
      (f) => f.failureReason?.startsWith("declined") ?? false,
    ).length;

    return ok({
      paymob,
      payments: {
        byStatus,
        everSucceeded: succeeded > 0,
      },
      recentFailures,
      failureKinds: { providerErrors, declines },

      // The combination is the point. Authenticating proves the API key
      // is good and nothing more; it says nothing about whether the
      // integration can actually take a card.
      reading: !paymob.configured
        ? "إعدادات Paymob مش كاملة؛ مفيش أي دفع هينجح لحد ما تتظبط."
        : !paymob.authenticated
          ? "Paymob رافض مفتاح الـ API. كل عمليات الدفع هتفشل لحد ما يتغيّر."
          : succeeded > 0
            ? "بيانات الدخول شغالة وفيه مدفوعات نجحت."
            : providerErrors > 0
              ? `مفتاح الـ API شغال، بس ${arCount(providerErrors, { one: "عملية واحدة", two: "عمليتين", few: "عمليات", many: "عملية" })} فشلت بخطأ من Paymob مش رفض من البنك. ده معناه إن المشكلة في الـ integration أو خطوة 3-D Secure، مش في بنك العميل — راجع الـ integration رقم ${paymob.integrationId} والـ iframe رقم ${paymob.iframeId} في لوحة Paymob، ودوّر على أرقام العمليات في سجل العمليات هناك.`
              : declines > 0
                ? "مفتاح الـ API شغال، والفشل كله رفض كروت من البنك، يعني مفيش حاجة تتصلح هنا. جرّب بكارت تاني."
                : "بيانات الدخول شغالة، بس لسه مفيش دفع نجح ومفيش حاجة متسجّلة تفسّر السبب.",
    });
  } catch (e) {
    log.error("[admin payment diagnostics]", e);
    return err("تعذّر فحص إعدادات الدفع", 500);
  }
}
