import { ok, err } from "@/lib/api";
import { requireBusinessAccess } from "@/lib/business-access";
import { businessHandle } from "@/lib/business/route";
import { cairoDateString } from "@/lib/bookings/instants";
import { operationsReport } from "@/lib/reports/operations";

/**
 * GET /api/business/reports/operations?from=YYYY-MM-DD&days=1..31 — the
 * daily operations report (lib/reports/operations). Revenue and
 * commission are money: the owner's (reports.read).
 */
export async function GET(req: Request) {
  return businessHandle("operations report", async () => {
    const { business } = await requireBusinessAccess("reports.read");
    const q = new URL(req.url).searchParams;
    const from = q.get("from") ?? cairoDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return err("تاريخ غير صحيح", 422);
    const days = Number(q.get("days") ?? 1);
    if (!Number.isInteger(days) || days < 1 || days > 31) return err("المدة من يوم لـ 31 يوم", 422);
    return ok(await operationsReport(business.id, from, days));
  });
}
