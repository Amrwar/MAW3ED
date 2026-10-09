import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { diagnosePaymob } from "@/lib/services/paymob";

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
        ? "Paymob is not fully configured; no payment can succeed until it is."
        : !paymob.authenticated
          ? "The API key is rejected by Paymob. Every payment will fail until it is replaced."
          : succeeded > 0
            ? "Credentials work and payments have succeeded."
            : providerErrors > 0
              ? `The API key authenticates, but ${providerErrors} transaction(s) failed with an error from Paymob rather than a card decline. That points at the integration or the 3-D Secure step, not at the customer's bank — check integration ${paymob.integrationId} and iframe ${paymob.iframeId} in the Paymob dashboard, and look up the transaction ids in its transaction log.`
              : declines > 0
                ? "The API key authenticates and the failures are card declines, which is the bank refusing rather than anything to fix here. Try a different card."
                : "Credentials work; no payment has succeeded yet and there is nothing recorded to explain why.",
    });
  } catch (e) {
    log.error("[admin payment diagnostics]", e);
    return err("تعذّر فحص إعدادات الدفع", 500);
  }
}
