import { getLang } from "@/lib/lang-server";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/layout/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import { db } from "@/lib/db";
import { getEffectivePlan, type Plan, type SubscriptionStatus } from "@/lib/plans";
import { getCapabilities, resourceLabel } from "@/lib/scheduling/capabilities";
import VerifyEmailBanner from "@/components/dashboard/VerifyEmailBanner";
import { noBusinessDestination } from "@/lib/dashboard/guard";
import { actingAccess, bookingScope, can, permissionsOf } from "@/lib/business-access";
import { readActingBusinessId, SCOPE_LABELS } from "@/lib/organizations/delegation";
import ActingBanner from "@/components/dashboard/ActingBanner";

export const metadata: Metadata = { title: "لوحة التحكم" };

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Operating a business for an organization: the delegated business, the
  // delegate's navigation and a banner saying so on every page.
  const actingCookie = await readActingBusinessId();
  const delegated = actingCookie ? await actingAccess(session.user.id) : null;
  if (delegated) {
    return <DelegateShell access={delegated} isAdmin={Boolean(session.user.adminRole)}>{children}</DelegateShell>;
  }

  const tokenBusinessId = session.user.businessId;

  // Core query — only fields that have always existed
  // Try by tokenBusinessId first (fast path), then fall back to ownerId.
  // The fallback handles stale JWT tokens where businessId points to a deleted business.
  let business = tokenBusinessId
    ? await db.business.findUnique({
        where:  { id: tokenBusinessId },
        select: { id: true, nameAr: true, nameEn: true, businessType: true, isPublished: true, city: { select: { nameAr: true, nameEn: true } } },
      })
    : null;

  if (!business) {
    business = await db.business.findUnique({
      where:  { ownerId: session.user.id },
      select: { id: true, nameAr: true, nameEn: true, businessType: true, isPublished: true, city: { select: { nameAr: true, nameEn: true } } },
    });
  }

  if (!business) redirect(await noBusinessDestination(session.user.id));

  const pendingCount = await db.booking.count({
    where: { businessId: business.id, status: "PENDING", isTest: false },
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


  // A business stays unpublished until its owner's email is confirmed,
  // and nothing told the owner. Said here, on every dashboard page, with
  // a way to get a new link, until it is done.
  const owner = await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  const needsEmailVerification = Boolean(owner?.email && !owner.emailVerified);
  // An owner who also manages a venue gets a way into that console.
  const hasVenueRoles = (await db.venueRole.count({ where: { userId: session.user.id } }).catch(() => 0)) > 0;

  // What this business calls its rooms, chairs or tables — derived from
  // what it has created, not from its category.
  const capabilities = await getCapabilities(business.id);
  const lang = await getLang();
  const resourceWord = resourceLabel(capabilities.resourceKind, lang);
  const businessName = (lang === "en" ? business.nameEn : null) || business.nameAr;
  const cityName = (lang === "en" ? business.city?.nameEn : null) || business.city?.nameAr || "";

  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-2)" }}>
      <DashboardSidebar
        businessName={businessName}
        cityName={cityName}
        pendingCount={pendingCount}
        plan={effectivePlan}
        resourceWord={resourceWord}
        hasResources={capabilities.resources}
        hasBranches={capabilities.branches}
        isAdmin={Boolean(session.user.adminRole)}
        needsSetup={!business.isPublished}
          hasVenueRoles={hasVenueRoles}
      />

      <div className="md:ms-64">
        <DashboardHeader
          businessName={businessName}
          cityName={cityName}
          pendingCount={pendingCount}
          plan={effectivePlan}
          resourceWord={resourceWord}
          hasResources={capabilities.resources}
          hasBranches={capabilities.branches}
          isAdmin={Boolean(session.user.adminRole)}
          needsSetup={!business.isPublished}
          hasVenueRoles={hasVenueRoles}
        />
        <main id="main" className="p-5 md:p-7 max-w-[1400px]">
          {/* The acting cookie is still set but grants nothing any more. */}
          {actingCookie ? <ActingBanner mode="ended" businessName="" organizations={[]} scopes={[]} /> : null}
          {needsEmailVerification ? <VerifyEmailBanner email={owner?.email ?? ""} lang={lang} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * The dashboard frame for a delegate: the operated business's name, the
 * navigation its granted scopes open, a pending count limited to the
 * bookings it may see, and nothing of the owner's — no plan, no setup
 * checklist, no email banner.
 */
async function DelegateShell({
  access,
  isAdmin,
  children,
}: {
  access: NonNullable<Awaited<ReturnType<typeof actingAccess>>>;
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  const { business, actor } = access;
  const delegation = actor.delegation!;
  const [full, pendingCount, capabilities, lang] = await Promise.all([
    db.business.findUnique({
      where: { id: business.id },
      select: { nameAr: true, nameEn: true, city: { select: { nameAr: true, nameEn: true } } },
    }),
    can(actor, "bookings.read")
      ? db.booking.count({ where: { ...bookingScope(business, actor), status: "PENDING", isTest: false } })
      : Promise.resolve(0),
    getCapabilities(business.id),
    getLang(),
  ]);
  const businessName = (lang === "en" ? full?.nameEn : null) || full?.nameAr || business.nameAr;
  const cityName = (lang === "en" ? full?.city?.nameEn : null) || full?.city?.nameAr || "";
  const resourceWord = resourceLabel(capabilities.resourceKind, lang);
  const permissions = permissionsOf(actor);
  const shared = {
    businessName,
    cityName,
    pendingCount,
    plan: "FREE" as Plan,
    resourceWord,
    hasResources: false,
    hasBranches: false,
    isAdmin,
    needsSetup: false,
    hasVenueRoles: true,
    delegatePermissions: permissions,
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-surface-2)" }}>
      <DashboardSidebar {...shared} />
      <div className="md:ms-64">
        <DashboardHeader {...shared} />
        <main id="main" className="p-5 md:p-7 max-w-[1400px]">
          <ActingBanner
            mode="active"
            businessName={businessName}
            organizations={[...new Set(delegation.via.map((v) => v.organizationName))]}
            scopes={delegation.scopes.map((sc) => ({ ar: SCOPE_LABELS[sc][0], en: SCOPE_LABELS[sc][1] }))}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
