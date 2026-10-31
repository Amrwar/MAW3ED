import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { can, resolveBusinessAccess, type BusinessAction } from "@/lib/business-access";
import { isActingElsewhere } from "@/lib/organizations/delegation";

/**
 * The business behind the current dashboard page.
 *
 * Every dashboard page needs this and each one was doing it slightly
 * differently — some trusting session.user.businessId, which is a value
 * baked into a token and can point at a business that has since been
 * deleted. This checks the token's id first because it is the fast
 * path, then falls back to the owner, which is the truth.
 */
export async function requireBusinessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  // Owner-only pages are off while operating another business.
  if (await isActingElsewhere(session.user.id)) redirect("/dashboard");

  const tokenBusinessId = session.user.businessId;

  const business =
    (tokenBusinessId
      ? await db.business.findUnique({
          where: { id: tokenBusinessId },
          select: { id: true, slug: true, nameAr: true, ownerId: true },
        })
      : null) ??
    (await db.business.findUnique({
      where: { ownerId: session.user.id },
      select: { id: true, slug: true, nameAr: true, ownerId: true },
    }));

  if (!business) redirect(await noBusinessDestination(session.user.id));

  // A stale token could name a business somebody else now owns.
  if (business.ownerId !== session.user.id) redirect(await noBusinessDestination(session.user.id));

  return { session, business };
}

/**
 * Where somebody with no business goes when they open the dashboard.
 *
 * Two very different people arrive here. An owner who signed up with an
 * email and has not finished setting up belongs in onboarding. A
 * customer — signed in with a verified phone, no password — clicked a
 * dashboard link by accident, and dropping them into "create your
 * business" is a trap: they are sent to their own account instead, with
 * a note saying why (rendered by the account layout).
 */
export async function noBusinessDestination(userId: string): Promise<string> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { password: true, phoneVerifiedAt: true, adminRole: true, _count: { select: { venueRoles: true } } },
  });
  // Somebody who manages a venue and owns no business is not an owner
  // who has not finished onboarding: their work is in the venue console.
  if (user?._count?.venueRoles) return "/org-admin";
  const isCustomer = !!user?.phoneVerifiedAt && !user.password && !user.adminRole;
  return isCustomer ? "/account?notice=no-business" : "/onboarding";
}

/**
 * The guard for dashboard pages a delegate may also open. The owner
 * passes as always; a delegate operating a business passes only with
 * the page's action among their granted scopes. Staff managers and
 * providers keep using the mobile app — the web dashboard stays the
 * owner's and the delegates'.
 */
export async function requireDashboardAccess(action: BusinessAction | readonly BusinessAction[]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const access = await resolveBusinessAccess(session.user.id);
  if (!access || (access.actor.role !== "OWNER" && access.actor.role !== "DELEGATE")) {
    redirect(await noBusinessDestination(session.user.id));
  }
  const wanted = typeof action === "string" ? [action] : action;
  if (!wanted.some((a) => can(access.actor, a))) redirect("/dashboard");
  return { session, business: access.business, actor: access.actor };
}
