import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { db } from "@/lib/db";
import { getEffectivePlan, type Plan, type SubscriptionStatus } from "@/lib/plans";

export const metadata: Metadata = { title: "لوحة التحكم | موعد" };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Find business — use token businessId first (fast path), fall back to ownerId
  // lookup for stale tokens (e.g. session minted before onboarding completed).
  const tokenBusinessId = session.user.businessId;

  const business = tokenBusinessId
    ? await db.business.findUnique({
        where:  { id: tokenBusinessId },
        select: { id: true, nameAr: true, city: { select: { nameAr: true } }, plan: true, subscriptionStatus: true, trialEndsAt: true },
      })
    : await db.business.findUnique({
        where:  { ownerId: session.user.id },
        select: { id: true, nameAr: true, city: { select: { nameAr: true } }, plan: true, subscriptionStatus: true, trialEndsAt: true },
      });

  if (!business) redirect("/onboarding");

  const pendingCount = await db.booking.count({
    where: { businessId: business.id, status: "PENDING" },
  });

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)]">
      <DashboardSidebar
        businessName={business.nameAr}
        cityName={business.city.nameAr}
        pendingCount={pendingCount}
        plan={getEffectivePlan(
          business.plan as Plan,
          business.subscriptionStatus as SubscriptionStatus,
          business.trialEndsAt,
        )}
      />

      <div className="md:ms-60">
        <DashboardHeader businessName={business.nameAr} />
        <main className="p-5 md:p-6">{children}</main>
      </div>
    </div>
  );
}
