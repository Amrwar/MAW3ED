import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { db } from "@/lib/db";
import { getEffectivePlan, type Plan, type SubscriptionStatus } from "@/lib/plans";
import { getCapabilities, resourceLabel } from "@/lib/scheduling/capabilities";
import { cookies } from "next/headers";

export const metadata: Metadata = { title: "لوحة التحكم" };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const tokenBusinessId = session.user.businessId;

  // Core query — only fields that have always existed
  // Try by tokenBusinessId first (fast path), then fall back to ownerId.
  // The fallback handles stale JWT tokens where businessId points to a deleted business.
  let business = tokenBusinessId
    ? await db.business.findUnique({
        where:  { id: tokenBusinessId },
        select: { id: true, nameAr: true, businessType: true, city: { select: { nameAr: true } } },
      })
    : null;

  if (!business) {
    business = await db.business.findUnique({
      where:  { ownerId: session.user.id },
      select: { id: true, nameAr: true, businessType: true, city: { select: { nameAr: true } } },
    });
  }

  if (!business) redirect("/onboarding");

  const pendingCount = await db.booking.count({
    where: { businessId: business.id, status: "PENDING" },
  });

  // Subscription fields — separate query with fallback so dashboard loads
  // even if the Prisma client was generated before the schema migration.
  let effectivePlan: Plan = "FREE";
  try {
    const sub = await db.business.findUnique({
      where:  { id: business.id },
      select: { plan: true, subscriptionStatus: true, trialEndsAt: true },
    });
    if (sub) {
      effectivePlan = getEffectivePlan(
        sub.plan as Plan,
        sub.subscriptionStatus as SubscriptionStatus,
        sub.trialEndsAt,
      );
    }
  } catch {
    // Prisma client not yet regenerated — fall back to FREE badge
  }

  const cityName = business.city?.nameAr ?? "";

  // What this business calls its rooms, chairs or tables — derived from
  // what it has created, not from its category.
  const capabilities = await getCapabilities(business.id);
  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as "ar" | "en";
  const resourceWord = resourceLabel(capabilities.resourceKind, lang);

  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-2)" }}>
      <DashboardSidebar
        businessName={business.nameAr}
        cityName={cityName}
        pendingCount={pendingCount}
        plan={effectivePlan}
        resourceWord={resourceWord}
        hasResources={capabilities.resources}
        hasBranches={capabilities.branches}
      />

      <div className="md:ms-64">
        <DashboardHeader
          businessName={business.nameAr}
          cityName={cityName}
          pendingCount={pendingCount}
          plan={effectivePlan}
          resourceWord={resourceWord}
          hasResources={capabilities.resources}
          hasBranches={capabilities.branches}
        />
        <main className="p-5 md:p-7 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
