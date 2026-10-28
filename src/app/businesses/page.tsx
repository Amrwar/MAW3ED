import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { localizePath } from "@/lib/locale-path";
import { alternatesFor } from "@/lib/seo/meta";
import { redirect } from "next/navigation";
import { requestNonce } from "@/lib/security/nonce";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { discoveryHref, parseDiscoveryQuery } from "@/lib/discovery/params";
import { getFacets, searchBusinesses } from "@/lib/discovery/search";
import { translations } from "@/lib/i18n";
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

  const lang = await getLang();
  const en = lang === "en";
  return {
    title: en ? "Browse businesses" : "تصفح الأعمال",
    description: en
      ? "Search the businesses you can book in Egypt — filter by specialty, city, price and free times."
      : "ابحث في الأنشطة المتاحة للحجز في مصر — فلتر حسب التخصص، المدينة، السعر والمواعيد المتاحة.",
    // Absolute, like every other page. A relative canonical is legal
    // but resolves against whatever host served the page.
    alternates: alternatesFor(discoveryHref(q), lang),
    robots: filtered || q.page > 1 ? { index: false, follow: true } : { index: true, follow: true },
  };
}

export default async function BusinessesPage({ searchParams }: Props) {
  // The nonce for this request's CSP; the ld+json tags below carry it
  // or the browser refuses to parse them.
  const nonce = await requestNonce();

  const query = parseDiscoveryQuery(await searchParams);
  const lang = await getLang();
  const t = translations[lang] ?? translations.ar;

  // Facets are scoped to the chosen city so the neighbourhood list is
  // only fetched when it can be shown.
  const [result, facets] = await Promise.all([
    searchBusinesses(query),
    getFacets(query.city || undefined),
  ]);

  // Past the last page — an old link, a hand-edited URL — the grid was
  // empty with no pager and nothing said why. The last real page is
  // what that visitor was after.
  if (result.pageCount > 0 && query.page > result.pageCount) {
    redirect(localizePath(discoveryHref({ ...query, page: result.pageCount }), lang));
  }

  return (
    <>
      <Navbar />
      <main id="main" className="min-h-screen">
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
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLdScript({
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
