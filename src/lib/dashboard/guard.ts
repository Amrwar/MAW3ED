import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

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

  if (!business) redirect("/onboarding");

  // A stale token could name a business somebody else now owns.
  if (business.ownerId !== session.user.id) redirect("/onboarding");

  return { session, business };
}
