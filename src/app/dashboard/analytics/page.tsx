import { getLang } from "@/lib/lang-server";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { translations } from "@/lib/i18n";
import AnalyticsClient from "./_components/AnalyticsClient";
import { loadAnalytics, thisCairoMonth } from "@/lib/dashboard/analytics";
import { getEffectivePlan, canUseFeature, type Plan, type SubscriptionStatus } from "@/lib/plans";

export const metadata: Metadata = { title: "الإحصائيات" };

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user?.businessId) redirect("/onboarding");

  const lang = await getLang();
  const an   = translations[lang].dashboard.analytics;

  const businessId = session.user.businessId;

  // ── Plan gate: analytics requires GROWTH+ ────────────────────────────────
  const bizPlan = await db.business.findUnique({
    where:  { id: businessId },
    select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
  });
  if (bizPlan) {
    const effectivePlan = getEffectivePlan(
      bizPlan.plan as Plan,
      bizPlan.subscriptionStatus as SubscriptionStatus,
      bizPlan.trialEndsAt,
    );
    if (!canUseFeature(effectivePlan, "analytics")) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-20 h-20 rounded-[var(--radius-lg)] bg-[var(--color-jade-soft)] flex items-center justify-center mx-auto mb-5">
            <span className="text-3xl">📊</span>
          </div>
          <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
            {an.upsell.title}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-sm leading-relaxed">
            {an.upsell.sub.split(an.upsell.growth)[0]}
            <strong className="text-[var(--color-jade)]">{an.upsell.growth}</strong>
            {an.upsell.sub.split(an.upsell.growth)[1]?.split(an.upsell.pro)[0]}
            <strong className="text-[var(--color-warn)]">{an.upsell.pro}</strong>
            {an.upsell.sub.split(an.upsell.pro)[1]}
          </p>
          <Link
            href="/pricing"
            className="px-6 py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            {an.upsell.cta}
          </Link>
        </div>
      );
    }
  }

  // This month in Cairo, the business's calendar (not the server's UTC day).
  const range   = thisCairoMonth();
  const initial = await loadAnalytics(businessId, range.from, range.to, lang);

  return <AnalyticsClient initial={initial} initialRange={range} />;
}
