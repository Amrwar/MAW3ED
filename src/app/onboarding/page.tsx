import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCategories, getCities } from "@/lib/data";
import OnboardingForm from "./_components/OnboardingForm";

export default async function OnboardingPage() {
  const session = await auth();

  // Already completed onboarding — send to dashboard
  if (session?.user?.businessId) redirect("/dashboard");

  const [categories, cities] = await Promise.all([
    getCategories(),
    getCities(),
  ]);

  return <OnboardingForm categories={categories} cities={cities} />;
}
