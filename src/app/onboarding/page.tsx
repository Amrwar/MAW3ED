import { db } from "@/lib/db";
import OnboardingForm from "./_components/OnboardingForm";

export default async function OnboardingPage() {
  const [categories, cities] = await Promise.all([
    db.category.findMany({ orderBy: { nameAr: "asc" } }),
    db.city.findMany({ orderBy: { nameAr: "asc" } }),
  ]);

  return <OnboardingForm categories={categories} cities={cities} />;
}
