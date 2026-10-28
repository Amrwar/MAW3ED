import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { alternatesFor } from "@/lib/seo/meta";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { requestNonce } from "@/lib/security/nonce";
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
  getPlatformReach,
  getPublishedBusinesses,
  SHOW_COUNTS_FROM,
} from "@/lib/data";
import { getSiteUrl } from "@/lib/env";
import { translations, type Lang } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return {
    title: { absolute: lang === "en"
      ? "Maw3ed — Book your appointment in seconds"
      : "موعد | Maw3ed — احجز ميعادك في ثواني" },
    description: lang === "en"
      ? "Find a clinic, salon, gym or centre near you in Egypt, see the free times and book in seconds. Booking is free and confirmed instantly."
      : "ابحث عن عيادة، صالون، جيم أو مركز قريب منك في مصر، شوف المواعيد المتاحة واحجز في ثوانٍ. الحجز مجاني والتأكيد فوري.",
    alternates: alternatesFor("/", lang),
  };
}

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
  const lang = await getLang();
  // The hero stores a city slug; /businesses and the data layer both
  // read slugs, so nothing has to translate an id along the way.
  const savedCity = cookieStore.get("maw3ed-city")?.value ?? "";

  // The hero paints from these; everything heavier streams in behind
  // its own skeleton. Only cities with a listing are offered: picking
  // one of the other twenty-odd led straight to an empty page.
  const [categories, cities] = await Promise.all([
    getCategoriesWithCounts(),
    getCitiesWithListings(),
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
          // A city saved before the list was trimmed to listed ones
          // would search an empty page behind a select showing "any".
          initialCity={cities.some((c) => c.slug === savedCity) ? savedCity : ""}
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

      {/* The page already closes with its own call to action above, so
          the footer does not repeat it. */}
      <Footer cta={false} />

      <OrganizationJsonLd lang={lang} />
    </>
  );
}

/* ─── Streamed sections ──────────────────────────────────────
   Each owns its query, so a slow one delays only its own row. */

const POPULAR_MIN_BOOKINGS = 10;
const POPULAR_MIN_BUSINESSES = 4;

async function PopularRow() {
  const businesses = await getPublishedBusinesses({
    take: 6,
    orderBy: "mostBooked",
  });

  // "Most booked" is a claim about the listings, so it waits until
  // there is something to compare: at least four of the six with ten
  // or more bookings. Below that the row calls itself "newest", which
  // the ordering also satisfies (ties broken by createdAt). One booking
  // somewhere used to be enough to call a row "where people book".
  const established = businesses.filter((b) => (b.bookingCount ?? 0) >= POPULAR_MIN_BOOKINGS).length;
  const popular = established >= POPULAR_MIN_BUSINESSES;

  return (
    <BusinessRowServer
      kind={popular ? "popular" : "newest"}
      businesses={businesses}
      viewAllHref="/businesses"
    />
  );
}

async function NearbyRow({ citySlug }: { citySlug: string }) {
  const [businesses, cities, lang] = await Promise.all([
    getPublishedBusinesses({ citySlug, take: 3 }),
    getCitiesWithListings(),
    getLang(),
  ]);

  const city = cities.find((c) => c.slug === citySlug);

  return (
    <BusinessRowServer
      kind="nearby"
      businesses={businesses}
      cityName={city && (lang === "en" ? city.nameEn || city.nameAr : city.nameAr)}
      viewAllHref={`/businesses?city=${citySlug}`}
    />
  );
}

async function TrustRow() {
  const reach = await getPlatformReach();
  return <TrustSignals reach={reach.businesses >= SHOW_COUNTS_FROM ? reach : null} />;
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
  const lang = await getLang();
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
async function OrganizationJsonLd({ lang }: { lang: Lang }) {
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
      // CSP counts a ld+json tag as a script, so it needs the nonce or
      // the browser drops it and the structured data silently vanishes.
      nonce={await requestNonce()}
      // Built from constants above, not from user input.
      dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
    />
  );
}
