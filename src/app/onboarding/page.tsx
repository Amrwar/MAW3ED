import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCategories, getCities } from "@/lib/data";
import OnboardingForm from "./_components/OnboardingForm";

export default async function OnboardingPage() {
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

  const [categories, cities] = await Promise.all([
    getCategories(),
    getCities(),
  ]);

  return <OnboardingForm categories={categories} cities={cities} />;
}
