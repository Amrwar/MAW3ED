import { readInvite } from "@/lib/organizations/associations";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCategories, getCities } from "@/lib/data";
import OnboardingForm from "./_components/OnboardingForm";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ create?: string; org_invite?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // The business is looked up, never taken from the token.
  //
  // There used to be a fast path here that redirected to /dashboard
  // whenever session.user.businessId was set, without checking the id
  // pointed at anything. The dashboard does check — by id, then by
  // ownerId — and sends you here when it finds nothing. So a token
  // holding a businessId for a business that no longer exists made the
  // two disagree permanently: the dashboard bounced to onboarding,
  // onboarding bounced straight back, and the browser gave up.
  //
  // It only showed on devices carrying an older session, which is why
  // it looked like a phone problem. The token is minted at sign-in and
  // lives for days; the business it names can be deleted in that time.
  //
  // The fast path is not worth one indexed lookup. ownerId is unique,
  // so this answers both "do they have a business" and "is the one in
  // their token still real" in a single query.
  const existing = await db.business.findUnique({
    where:  { ownerId: session.user.id },
    select: { id: true },
  });
  if (existing) redirect("/dashboard");

  // Somebody who manages a venue and owns no business signed in to run
  // the venue, not to open a shop: sign-in sends people without a
  // business here, so they are passed on to their console. ?create=1 is
  // the way through for a manager who does want a business of their own.
  const { create, org_invite } = await searchParams;
  if (create !== "1" && !org_invite && (await db.venueRole.count({ where: { userId: session.user.id } })) > 0) {
    redirect("/org-admin");
  }

  // Arrived through an organization's invitation: say who is inviting,
  // and hand the token to the wizard. A dead link is said plainly here
  // rather than failing at the last step.
  let invite: { token: string; orgName: string; relation: string; scopes: string[] } | null = null;
  let inviteDead = false;
  if (org_invite) {
    try {
      const read = await readInvite(org_invite);
      invite = { token: org_invite, orgName: read.organization.nameAr, relation: read.relation, scopes: read.requestedScopes };
    } catch {
      inviteDead = true;
    }
  }

  const [categories, cities] = await Promise.all([
    getCategories(),
    getCities(),
  ]);

  return <OnboardingForm categories={categories} cities={cities} invite={invite} inviteDead={inviteDead} />;
}
