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

    return ok({
      paymob,
      payments: {
        byStatus,
        everSucceeded: succeeded > 0,
      },
      recentFailures,
      // Said plainly, because the combination is the whole point: a
      // working credential plus zero successes means the declines are
      // coming from the card side, and no amount of changing settings
      // will fix that.
      reading: !paymob.configured
        ? "Paymob is not fully configured; no payment can succeed until it is."
        : !paymob.authenticated
          ? "The API key is rejected by Paymob. Every payment will fail until it is replaced."
          : succeeded === 0
            ? "Credentials work, but no payment has ever succeeded. The failures are coming from the transactions themselves — check the decline reasons below and Paymob's own transaction log."
            : "Credentials work and payments have succeeded.",
    });
  } catch (e) {
    log.error("[admin payment diagnostics]", e);
    return err("تعذّر فحص إعدادات الدفع", 500);
  }
}
