import { getCategories, getCities } from "@/lib/data";
import OnboardingForm from "./_components/OnboardingForm";

export default async function OnboardingPage() {
  const [categories, cities] = await Promise.all([
    getCategories(),
    getCities(),
  ]);

  return <OnboardingForm categories={categories} cities={cities} />;
}
