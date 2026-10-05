import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { getCategories, getCities, getPublishedBusinesses } from "@/lib/data";
import { dayOfWeekFor, parseWhen } from "@/lib/search";
import BusinessesClient from "./_components/BusinessesClient";

interface Props {
  searchParams: Promise<{
    q?: string;
    city?: string;
    category?: string;
    /** "today" | "tomorrow". Anything else means no day filter. */
    when?: string;
  }>;
}

export const metadata: Metadata = { title: "تصفح الأعمال | موعد" };

export default async function BusinessesPage({ searchParams }: Props) {
  const { q, city, category, when } = await searchParams;

  // The hero asks "when"; availability is the only time signal the
  // schema has, so this narrows to businesses that keep hours that
  // day rather than claiming a free slot.
  const dayOfWeek = dayOfWeekFor(when) ?? undefined;

  const [businesses, categories, cities] = await Promise.all([
    getPublishedBusinesses({
      search: q,
      cityId: city,
      categorySlug: category,
      dayOfWeek,
    }),
    getCategories(),
    getCities(),
  ]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <BusinessesClient
          businesses={businesses}
          categories={categories}
          cities={cities}
          initialQ={q ?? ""}
          initialCity={city ?? ""}
          initialCategory={category ?? ""}
          initialWhen={parseWhen(when)}
        />
      </main>
      <Footer />
    </>
  );
}
