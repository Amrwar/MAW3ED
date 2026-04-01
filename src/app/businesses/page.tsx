import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getCategories, getCities, getPublishedBusinesses } from "@/lib/data";
import BusinessesClient from "./_components/BusinessesClient";

interface Props {
  searchParams: Promise<{ q?: string; city?: string; category?: string }>;
}

export const metadata: Metadata = { title: "تصفح الأعمال | موعد" };

export default async function BusinessesPage({ searchParams }: Props) {
  const { q, city, category } = await searchParams;

  const [businesses, categories, cities] = await Promise.all([
    getPublishedBusinesses({ search: q, cityId: city, categorySlug: category }),
    getCategories(),
    getCities(),
  ]);

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        <BusinessesClient
          businesses={businesses}
          categories={categories}
          cities={cities}
          initialQ={q ?? ""}
          initialCity={city ?? ""}
          initialCategory={category ?? ""}
        />
      </main>
      <Footer />
    </>
  );
}
