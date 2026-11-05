/**
 * /payment/subscription/return
 *
 * Paymob redirects here after a subscription upgrade payment.
 * We read the business's current subscription status from the DB (authoritative).
 * The webhook has usually fired by the time the customer lands here.
 */

import type { Metadata } from "next";
import Link from "@/components/shared/LocaleLink";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CheckCircle, XCircle, Clock, ArrowRight } from "lucide-react";
import { PLAN_NAMES_AR, PLAN_NAMES_EN, type Plan } from "@/lib/plans";
import { getLang } from "@/lib/lang-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getLang()) === "en" ? "Subscription result" : "نتيجة الاشتراك", robots: { index: false, follow: false } };
}
export const dynamic = "force-dynamic";

export default async function SubscriptionReturnPage() {
  const session = await auth();
  const en = (await getLang()) === "en";
  const names = en ? PLAN_NAMES_EN : PLAN_NAMES_AR;
  if (!session?.user?.businessId) redirect("/dashboard");

  const business = await db.business.findUnique({
    where:  { id: session.user.businessId },
    select: {
      plan:               true,
      subscriptionStatus: true,
      currentPeriodEnd:   true,
      pendingPlan:        true,
    },
  });

  if (!business) redirect("/dashboard");

  const isActive  = business.subscriptionStatus === "ACTIVE" && business.plan !== "FREE";
  const isFailed  = !business.pendingPlan && !isActive;
  const isPending = !!business.pendingPlan;

  const planName = isActive
    ? names[business.plan as Plan]
    : business.pendingPlan
    ? names[business.pendingPlan as Plan]
    : "";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4" dir={en ? "ltr" : "rtl"}>
      <div className="w-full max-w-md">

        {/* ── Active / success ── */}
        {isActive && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-ok-soft)] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={44} className="text-[var(--color-ok)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              {en ? "Your plan is active" : "الاشتراك اتفعّل!"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              {en ? (
                <>You&apos;re now on the <strong>{planName}</strong> plan, with everything it includes.</>
              ) : (
                <>إنت دلوقتي على باقة <strong>{planName}</strong>، بكل اللي فيها.</>
              )}
            </p>
            {business.currentPeriodEnd && (
              <p className="text-xs text-[var(--color-text-muted)] mb-6">
                {en ? "Renews on:" : "التجديد يوم:"}{" "}
                <span dir="ltr" className="font-medium">
                  {business.currentPeriodEnd.toISOString().split("T")[0]}
                </span>
              </p>
            )}
            <Link
              href="/dashboard"
              className="block w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              {en ? "Go to the dashboard" : "روح للوحة التحكم"}
            </Link>
          </div>
        )}

        {/* ── Still pending (webhook not fired yet) ── */}
        {isPending && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-warn-soft)] rounded-full flex items-center justify-center mx-auto mb-5">
              <Clock size={44} className="text-[var(--color-star)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              {en ? "Checking your payment…" : "بنتأكد من الدفع…"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              {en
                ? "We received your payment and are checking it. Your plan will be active within a minute."
                : "دفعتك وصلت وبنتأكد منها. الاشتراك هيتفعّل خلال دقيقة."}
            </p>
            <Link
              href="/dashboard/settings?tab=subscription"
              className="block w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              {en ? "Check the subscription's status" : "شوف حالة الاشتراك"}
            </Link>
          </div>
        )}

        {/* ── Failed ── */}
        {isFailed && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-danger-soft)] rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={44} className="text-[var(--color-danger)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              {en ? "The payment didn't go through" : "الدفع ماتمّش"}
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              {en
                ? "The payment wasn't completed, so the plan isn't active. You can try again."
                : "الدفع ماكملش، فالاشتراك ماتفعّلش. تقدر تجرب تاني."}
            </p>
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <ArrowRight size={15} />
              {en ? "See the plans" : "شوف الباقات"}
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
