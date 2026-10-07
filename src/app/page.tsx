import type { Metadata } from "next";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { canonicalFor } from "@/lib/seo/meta";
import { Suspense } from "react";
import { cookies } from "next/headers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSearch from "@/features/home/HeroSearch";
import CategoriesSection from "@/features/home/CategoriesSection";
import BusinessRow, { BusinessRowSkeleton } from "@/features/home/BusinessRow";
import HowItWorks from "@/features/home/HowItWorks";
import TrustSignals from "@/features/home/TrustSignals";
import WhyJoin from "@/features/home/WhyJoin";
import FAQ from "@/features/home/FAQ";
import FinalCTA from "@/features/home/FinalCTA";
import SectionBoundary from "@/components/shared/SectionBoundary";
import {
  getCategoriesWithCounts,
  getCitiesWithListings,
  getCities,
  getPlatformReach,
  getPublishedBusinesses,
} from "@/lib/data";
import { getSiteUrl } from "@/lib/env";
import { translations, type Lang } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "موعد | MAW3ED — احجز موعدك في ثوانٍ",
  description:
    "ابحث عن عيادة، صالون، جيم أو مركز قريب منك في مصر، شوف المواعيد المتاحة واحجز في ثوانٍ. الحجز مجاني والتأكيد فوري.",
  alternates: { canonical: canonicalFor("/") },
};

/**
 * The page answers one question in order: what do you need, where,
 * and when — then shows you somewhere to book it.
 *
 * Every figure on this page is counted out of the database. The build
 * this replaces advertised 300+ businesses, 12,000+ bookings, a 4.9
 * average rating and 31,400 reviews; the real figures are far smaller
 * and there is no reviews table at all, so the rating sections are
 * gone rather than restated.
 */
export default async function HomePage() {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  // The hero stores a city slug; /businesses and the data layer both
  // read slugs, so nothing has to translate an id along the way.
  const savedCity = cookieStore.get("maw3ed-city")?.value ?? "";

  // The hero paints from these; everything heavier streams in behind
  // its own skeleton.
  const [categories, cities] = await Promise.all([
    getCategoriesWithCounts(),
    getCities(),
  ]);

  // One copy of the section-failure wording, spread into each boundary.
  const err = (translations[lang] ?? translations.ar).sectionError;
  const e = { title: err.title, body: err.body, retryLabel: err.retry };

  return (
    <>
      <Navbar />

      <main id="main">
        {/* 1 — What, where, when */}
        <HeroSearch
          cities={cities}
          suggestions={categories.filter((c) => c.count > 0).slice(0, 5)}
          initialCity={savedCity}
        />

        {/* 2 — Browse by what you need done */}
        <CategoriesSection categories={categories} />

        {/* 3 — Where people are actually booking */}
        <SectionBoundary {...e}>
          <Suspense fallback={<BusinessRowSkeleton />}>
            <PopularRow />
          </Suspense>
        </SectionBoundary>

        {/* 4 — In the city this visitor last chose. Renders nothing
               until they have chosen one. */}
        {savedCity && (
          <SectionBoundary {...e}>
            <Suspense fallback={<BusinessRowSkeleton count={3} />}>
              <NearbyRow citySlug={savedCity} />
            </Suspense>
          </SectionBoundary>
        )}

        {/* 5 — Three steps to a booking */}
        <HowItWorks />

        {/* 6 — What the platform guarantees, with the real counts */}
        <SectionBoundary {...e}>
          <Suspense fallback={null}>
            <TrustRow />
          </Suspense>
        </SectionBoundary>

        {/* 7 — The pitch to business owners */}
        <WhyJoin />

        {/* 8 — Objections.
               A testimonials section used to sit here. Its quotes were
               written by hand in src/data/testimonials.ts and
               presented as real customers, so it is gone until there
               is something real to quote. */}
        <FAQ />

        {/* 9 — Close */}
        <FinalCTA />
      </main>

      <Footer />

      <OrganizationJsonLd lang={lang} />
    </>
  );
}

/* ─── Streamed sections ──────────────────────────────────────
   Each owns its query, so a slow one delays only its own row. */

async function PopularRow() {
  const businesses = await getPublishedBusinesses({
    take: 6,
    orderBy: "mostBooked",
  });

  // With nothing booked yet there is no popularity to claim, so the
  // row calls itself "newest" instead — which the ordering also
  // satisfies, since bookings all tie at zero and createdAt breaks it.
  const anyBookings = businesses.some((b) => (b.bookingCount ?? 0) > 0);

  return (
    <BusinessRowServer
      kind={anyBookings ? "popular" : "newest"}
      businesses={businesses}
      viewAllHref="/businesses"
    />
  );
}

async function NearbyRow({ citySlug }: { citySlug: string }) {
  const [businesses, cities] = await Promise.all([
    getPublishedBusinesses({ citySlug, take: 3 }),
    getCitiesWithListings(),
  ]);

  const city = cities.find((c) => c.slug === citySlug);

  return (
    <BusinessRowServer
      kind="nearby"
      businesses={businesses}
      cityName={city?.nameAr}
      viewAllHref={`/businesses?city=${citySlug}`}
    />
  );
}

async function TrustRow() {
  const reach = await getPlatformReach();
  return <TrustSignals reach={reach} />;
}

/**
 * Picks the copy for a row on the server so the client component stays
 * a presentational one. The labels live in the translation file; this
 * only decides which of them applies.
 */
async function BusinessRowServer({
  kind,
  businesses,
  cityName,
  viewAllHref,
}: {
  kind: "popular" | "newest" | "nearby";
  businesses: Awaited<ReturnType<typeof getPublishedBusinesses>>;
  cityName?: string;
  viewAllHref: string;
}) {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const f = (translations[lang] ?? translations.ar).featured;

  if (kind === "nearby") {
    return (
      <BusinessRow
        eyebrow={f.nearbyEyebrow}
        title={cityName ? `${f.nearbyTitle} — ${cityName}` : f.nearbyTitle}
        note={f.nearbyNote}
        businesses={businesses}
        viewAllHref={viewAllHref}
        empty={{ title: f.nearbyEmptyTitle, body: f.nearbyEmptyBody }}
      />
    );
  }

  return (
    <BusinessRow
      eyebrow={kind === "popular" ? f.popularEyebrow : f.newestEyebrow}
      title={kind === "popular" ? f.popularTitle : f.newestTitle}
      businesses={businesses}
      viewAllHref={viewAllHref}
    />
  );
}

/**
 * Organization + SearchAction markup, so a search box can appear under
 * the result in Google. The per-business LocalBusiness markup on
 * /company/[slug] is unchanged.
 */
function OrganizationJsonLd({ lang }: { lang: Lang }) {
  const site = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: lang === "ar" ? "موعد" : "Maw3ed",
    alternateName: "MAW3ED",
    url: site,
    logo: `${site}/icon.png`,
    areaServed: { "@type": "Country", name: "Egypt" },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${site}/businesses?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      // Built from constants above, not from user input.
      dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
    />
  );
}
