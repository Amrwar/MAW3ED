import { loadAnalytics } from "@/lib/dashboard/analytics";
import { getLang } from "@/lib/lang-server";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { isoDate } from "@/lib/query-params";
import { businessAllows, cheapestPlanWith, type Plan, type SubscriptionStatus } from "@/lib/plans";

export type { AnalyticsPayload, RevenuePoint, ServiceSlice, HeatCell } from "@/lib/dashboard/analytics";

/**
 * GET /api/business/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * The analytics page for a date range. The rules (what counts, what is
 * "completed booking value", who is a repeat customer) live in
 * lib/dashboard/analytics.ts, shared with the page's first render.
 */
export async function GET(req: Request) {
  try {
    const { business } = await requireBusiness();
    // The page was gated by plan; the data behind it was not, so a
    // free account could read it by calling this directly. The same rule
    // now answers here.
    if (
      !businessAllows(
        {
          plan: business.plan as Plan,
          subscriptionStatus: business.subscriptionStatus as SubscriptionStatus,
          trialEndsAt: business.trialEndsAt,
        },
        "analytics",
      )
    ) {
      return err("التحليلات متاحة في الباقات المدفوعة", 403, { code: "plan-required", upgradeTo: cheapestPlanWith("analytics") });
    }
    const { searchParams } = new URL(req.url);

    const fromStr = searchParams.get("from");
    const toStr   = searchParams.get("to");

    if (!fromStr || !toStr) return err("حدد بداية ونهاية الفترة", 400);
    if (!isoDate.safeParse(fromStr).success || !isoDate.safeParse(toStr).success) {
      return err("تاريخ غير صحيح", 400, { code: "bad-params" });
    }
    // A range that ends before it starts has no answer; saying so beats
    // an empty report that looks like a bad month.
    if (fromStr > toStr) return err("بداية الفترة لازم تكون قبل نهايتها", 400, { code: "range" });

    // A year is the longest range the page offers a chart for; a longer
    // one is a full-table read for a chart nobody can read.
    if (Date.parse(toStr) - Date.parse(fromStr) > 400 * 86_400_000) {
      return err("الفترة طويلة جدًا", 400, { code: "range" });
    }
    return ok(await loadAnalytics(business.id, fromStr, toStr, await getLang()));
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[analytics GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
