import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCategories, getCities } from "@/lib/data";
import OnboardingForm from "./_components/OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Check session first (fast path), then DB (handles stale sessions)
  if (session.user.businessId) redirect("/dashboard");

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
