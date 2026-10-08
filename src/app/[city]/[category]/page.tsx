import type { Metadata } from "next";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { requestNonce } from "@/lib/security/nonce";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import BusinessCard from "@/components/shared/BusinessCard";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import { translations, type Lang } from "@/lib/i18n";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { getLandingCombos, resolveCombo, prerenderHints } from "@/lib/seo/landing";
import { buildMetadata, parsePage } from "@/lib/seo/meta";
import { EMPTY_QUERY } from "@/lib/discovery/params";
import { searchBusinesses } from "@/lib/discovery/search";

type Props = {
  params: Promise<{ city: string; category: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * A city-and-category landing page: /cairo/clinics.
 *
 * These exist only where somebody has actually listed a business. The
 * full product of 27 cities and 14 categories is 378 pages, five of
 * which would have anything on them; the other 373 are a 404 here
 * rather than a page saying "no results", because an empty page is
 * still a page Google will index and judge the site by.
 *
 * generateStaticParams names the five that exist, so they are built
 * ahead of time, and dynamicParams lets a sixth appear the moment a
 * business is listed in a new pair without a deploy.
 */
export async function generateStaticParams() {
  const combos = await prerenderHints("city/category combos", getLandingCombos);
  return combos.map((c) => ({ city: c.citySlug, category: c.categorySlug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { city, category } = await params;
  const page = parsePage((await searchParams).page);

  const combo = await resolveCombo(city, category);
  if (!combo) return { title: "غير موجود", robots: { index: false, follow: false } };

  const where = `${combo.category.nameAr} في ${combo.city.nameAr}`;

  return buildMetadata({
    // Unique per pair, and says what the page is rather than what the
    // site is: somebody searching "دكتور أسنان مدينة نصر" should see
    // their words back.
    title: `${where} — احجز أونلاين`,
    description:
      combo.count === 1
        ? `${where}: نشاط واحد بيستقبل حجوزات أونلاين على موعد. شوف المواعيد المتاحة واحجز في ثوانٍ.`
        : `${combo.count} من ${where} بيستقبلوا حجوزات أونلاين على موعد. قارن المواعيد والأسعار واحجز في ثوانٍ.`,
    path: `/${combo.city.slug}/${combo.category.slug}`,
    page,
  });
}

export default async function CityCategoryPage({ params, searchParams }: Props) {
  // The nonce for this request's CSP; the ld+json tags below carry it
  // or the browser refuses to parse them.
  const nonce = await requestNonce();

  const { city, category } = await params;
  const page = parsePage((await searchParams).page);

  const combo = await resolveCombo(city, category);
  // Unknown pair, or a pair with nothing in it. Both are a 404.
  if (!combo) notFound();

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;
  const isAr = lang === "ar";

  // The same engine the search page uses, so a landing page and the
  // equivalent filtered search can never show different results.
  const { businesses: items, total, pageCount } = await searchBusinesses({
    ...EMPTY_QUERY,
    city: combo.city.slug,
    category: combo.category.slug,
    page,
  });

  // A page past the end is not a page. Asking for page nine of a
  // one-page list should not render an empty grid.
  if (items.length === 0 && page > 1) notFound();

  const cityName = isAr ? combo.city.nameAr : (combo.city.nameEn ?? combo.city.nameAr);
  const catName = isAr
    ? combo.category.nameAr
    : (combo.category.nameEn ?? combo.category.nameAr);

  const trail = [
    { name: isAr ? "الرئيسية" : "Home", path: "/" },
    { name: isAr ? "المدن" : "Cities", path: "/cities" },
    { name: cityName, path: `/cities/${combo.city.slug}` },
    { name: catName },
  ];

  const totalPages = Math.max(1, pageCount);

  return (
    <>
      <Navbar />
      <main id="main" className="min-h-screen bg-[var(--color-ground)] pt-20">
        <Container>
          <div className="py-8">
            <Breadcrumbs
              items={trail.map((s) => ({ label: s.name, href: s.path }))}
              lang={lang}
              label={t.profile?.breadcrumb ?? "مسار التنقل"}
            />

            <header className="mt-5 mb-7">
              <h1 className="m-0 text-[1.75rem] font-light tracking-tight text-[var(--color-ink)]">
                {catName} <span className="text-[var(--color-subtle)]">في</span> {cityName}
              </h1>
              <p className="num m-0 mt-2 text-[0.875rem] text-[var(--color-subtle)]">
                {total === 1
                  ? isAr
                    ? "نشاط واحد بيستقبل حجوزات"
                    : "1 business taking bookings"
                  : isAr
                    ? `${total} أنشطة بتستقبل حجوزات`
                    : `${total} businesses taking bookings`}
              </p>
            </header>

            {/* Named for the heading outline. Each card is an h3, and
                without this they hung straight off the h1. */}
            <h2 className="sr-only-label">
              {isAr ? "الأنشطة المتاحة" : "Available businesses"}
            </h2>

            <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((b) => (
                <li key={b.slug} className="min-w-0">
                  <BusinessCard business={b} />
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <nav className="mt-8" aria-label={isAr ? "صفحات" : "Pages"}>
                <ul className="m-0 flex list-none justify-center gap-2 p-0">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <li key={n}>
                      {/* Real links, so a crawler can follow them. Page
                          one never carries ?page=1 — that URL would be a
                          second address for the same page. */}
                      <Link
                        href={
                          n === 1
                            ? `/${combo.city.slug}/${combo.category.slug}`
                            : `/${combo.city.slug}/${combo.category.slug}?page=${n}`
                        }
                        aria-current={n === page ? "page" : undefined}
                        className={`num flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-md)] border px-3 text-[0.875rem] ${
                          n === page
                            ? "border-[var(--color-jade)] bg-[var(--color-jade)] font-bold text-white"
                            : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]"
                        }`}
                      >
                        {n}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {/* Somewhere to go next. A landing page with one result and
                no way onward is a dead end, which is the other half of
                why thin pages are judged badly. */}
            <RelatedLinks
              citySlug={combo.city.slug}
              cityName={cityName}
              categorySlug={combo.category.slug}
              categoryName={catName}
              isAr={isAr}
            />
          </div>
        </Container>
      </main>
      <Footer />

      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            buildBreadcrumbJsonLd(trail.map((s) => ({ name: s.name, path: s.path }))),
          ),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            buildItemListJsonLd(items.map((b) => ({ slug: b.slug, name: b.nameAr }))),
          ),
        }}
      />
    </>
  );
}

/**
 * The other pages that exist around this one.
 *
 * Only real ones: the same category in other cities that have it, and
 * the other categories in this city. Both lists come from the landing
 * module, so every link here leads to a page that renders.
 */
async function RelatedLinks({
  citySlug,
  cityName,
  categorySlug,
  categoryName,
  isAr,
}: {
  citySlug: string;
  cityName: string;
  categorySlug: string;
  categoryName: string;
  isAr: boolean;
}) {
  const combos = await getLandingCombos();

  const sameCategoryElsewhere = combos.filter(
    (c) => c.categorySlug === categorySlug && c.citySlug !== citySlug,
  );
  const otherCategoriesHere = combos.filter(
    (c) => c.citySlug === citySlug && c.categorySlug !== categorySlug,
  );

  if (sameCategoryElsewhere.length === 0 && otherCategoriesHere.length === 0) {
    return (
      <p className="mt-10 text-center text-[0.8125rem] text-[var(--color-subtle)]">
        <Link href="/businesses" className="font-bold text-[var(--color-jade)]">
          {isAr ? "تصفّح كل الأعمال" : "Browse all businesses"}
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-12 grid gap-8 border-t border-[var(--color-line)] pt-8 sm:grid-cols-2">
      {sameCategoryElsewhere.length > 0 && (
        <section>
          <h2 className="m-0 mb-3 text-[0.875rem] font-bold text-[var(--color-ink)]">
            {isAr ? `${categoryName} في مدن تانية` : `${categoryName} in other cities`}
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {sameCategoryElsewhere.map((c) => (
              <li key={`${c.citySlug}-${c.categorySlug}`}>
                <Link
                  href={`/${c.citySlug}/${c.categorySlug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[0.78125rem] text-[var(--color-muted)] hover:border-[var(--color-jade)] hover:text-[var(--color-jade)]"
                >
                  {isAr ? c.cityNameAr : (c.cityNameEn ?? c.cityNameAr)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {otherCategoriesHere.length > 0 && (
        <section>
          <h2 className="m-0 mb-3 text-[0.875rem] font-bold text-[var(--color-ink)]">
            {isAr ? `تخصصات تانية في ${cityName}` : `Other categories in ${cityName}`}
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {otherCategoriesHere.map((c) => (
              <li key={`${c.citySlug}-${c.categorySlug}`}>
                <Link
                  href={`/${c.citySlug}/${c.categorySlug}`}
                  className="inline-flex min-h-9 items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 text-[0.78125rem] text-[var(--color-muted)] hover:border-[var(--color-jade)] hover:text-[var(--color-jade)]"
                >
                  {isAr ? c.categoryNameAr : (c.categoryNameEn ?? c.categoryNameAr)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
