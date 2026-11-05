import { ok, err } from "@/lib/api";
import { adminNotFound, requireAdminApi } from "@/lib/admin/guard";
import { log } from "@/lib/logger";
import { reconcilePayments } from "@/lib/payments/reconcile";

/**
 * GET /api/admin/payments/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD
 * (at most 92 days): totals per provider and kind, and every payment whose
 * ledger does not add up (lib/payments/reconcile). payments.read.
 */
export async function GET(req: Request) {
  try {
    const admin = await requireAdminApi("payments.read");
    if (!admin) return adminNotFound();
    const q = new URL(req.url).searchParams;
    const from = new Date(`${q.get("from") ?? ""}T00:00:00Z`);
    const to = new Date(`${q.get("to") ?? ""}T00:00:00Z`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || to.getTime() - from.getTime() > 92 * 86_400_000) {
      return err("فترة غير صحيحة (من يوم لـ 92 يوم)", 422, { code: "bad-range" });
    }
    return ok(await reconcilePayments(from, to));
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[admin reconciliation]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
