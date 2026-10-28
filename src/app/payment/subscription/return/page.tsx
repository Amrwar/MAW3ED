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
import { PLAN_NAMES_AR, type Plan } from "@/lib/plans";

export const metadata: Metadata = { title: "نتيجة الاشتراك" };
export const dynamic = "force-dynamic";

export default async function SubscriptionReturnPage() {
  const session = await auth();
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
    ? PLAN_NAMES_AR[business.plan as Plan]
    : business.pendingPlan
    ? PLAN_NAMES_AR[business.pendingPlan as Plan]
    : "";

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* ── Active / success ── */}
        {isActive && (
          <div className="card text-center p-8">
            <div className="w-20 h-20 bg-[var(--color-ok-soft)] rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={44} className="text-[var(--color-ok)]" />
            </div>
            <h1 className="text-xl font-extrabold text-[var(--color-text-primary)] mb-2">
              تم تفعيل الاشتراك!
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              أنت الآن على خطة <strong>{planName}</strong>.
              استمتع بجميع المميزات المتاحة في خطتك.
            </p>
            {business.currentPeriodEnd && (
              <p className="text-xs text-[var(--color-text-muted)] mb-6">
                تجديد الاشتراك بتاريخ:{" "}
                <span dir="ltr" className="font-medium">
                  {business.currentPeriodEnd.toISOString().split("T")[0]}
                </span>
              </p>
            )}
            <Link
              href="/dashboard"
              className="block w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              الذهاب إلى لوحة التحكم
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
              جارٍ التحقق من الدفع…
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              تم استلام دفعتك ونحن نتحقق منها. سيُفعَّل اشتراكك خلال دقيقة.
            </p>
            <Link
              href="/dashboard/settings"
              className="block w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              تحقق من حالة الاشتراك
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
              فشلت عملية الدفع
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mb-6 leading-relaxed">
              لم يتم استكمال الدفع. لم يُفعَّل الاشتراك. يمكنك المحاولة مرة أخرى.
            </p>
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 w-full text-center py-3 rounded-[var(--radius-md)] bg-[var(--color-brand)] text-white text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <ArrowRight size={15} />
              عرض الخطط
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
