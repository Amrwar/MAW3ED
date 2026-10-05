import type { Metadata } from "next";
import { cookies } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { discoveryHref, parseDiscoveryQuery } from "@/lib/discovery/params";
import { getFacets, searchBusinesses } from "@/lib/discovery/search";
import { translations, type Lang } from "@/lib/i18n";
import BusinessesClient from "./_components/BusinessesClient";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Only the first unfiltered page is worth indexing on its own. A
 * filtered or deep-paged view points at itself as canonical so it stays
 * shareable, but is kept out of the index — a crawler following every
 * combination of nine filters would find a near-infinite space of
 * near-identical pages.
 */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const q = parseDiscoveryQuery(await searchParams);
  const filtered = Boolean(
    q.q || q.category || q.city || q.neighborhood || q.rating !== null ||
      q.minPrice !== null || q.maxPrice !== null || q.availability !== "any" ||
      q.verified || q.instant || q.online,
  );

  return {
    title: "تصفح الأعمال",
    description:
      "ابحث في الأنشطة المتاحة للحجز في مصر — فلتر حسب التخصص، المدينة، السعر والمواعيد المتاحة.",
    alternates: { canonical: discoveryHref(q) },
    robots: filtered || q.page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function BusinessesPage({ searchParams }: Props) {
  const query = parseDiscoveryQuery(await searchParams);

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  // Facets are scoped to the chosen city so the neighbourhood list is
  // only fetched when it can be shown.
  const [result, facets] = await Promise.all([
    searchBusinesses(query),
    getFacets(query.city || undefined),
  ]);

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <BusinessesClient
          query={query}
          businesses={result.businesses}
          total={result.total}
          pageCount={result.pageCount}
          facets={facets}
          priceBounds={result.priceBounds}
        />
      </main>
      <Footer />

      {/* An ItemList of what is on this page, so a result can carry the
          business names rather than just the page title. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: t.businesses.pageTitle,
            numberOfItems: result.total,
            itemListElement: result.businesses.map((b, i) => ({
              "@type": "ListItem",
              position: (query.page - 1) * result.businesses.length + i + 1,
              url: `/company/${b.slug}`,
              name: lang === "en" && b.nameEn ? b.nameEn : b.nameAr,
            })),
          }),
        }}
      />
    </>
  );
}
