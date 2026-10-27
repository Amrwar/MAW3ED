import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { MapPin, ArrowLeft, ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import BusinessCard from "@/components/shared/BusinessCard";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import { getCityBySlug, getPublishedBusinesses } from "@/lib/data";
import { MIN_BUSINESSES, getLandingCities, getLandingCombos, prerenderHints } from "@/lib/seo/landing";
import { buildMetadata, notFoundMetadata } from "@/lib/seo/meta";
import { getLang } from "@/lib/lang-server";
import { db } from "@/lib/db";
import { arCount } from "@/lib/fmt";
import { translations } from "@/lib/i18n";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { requestNonce } from "@/lib/security/nonce";

const BIZ = { one: "نشاط واحد", two: "نشاطين", few: "أنشطة", many: "نشاط" };

type Props = { params: Promise<{ city: string }> };

/**
 * Only cities that have a business.
 *
 * There are 27 cities in the database and four of them have a listing.
 * Building the other 23 produces pages whose entire content is "nothing
 * here", and the sitemap used to advertise every one of them.
 */
export async function generateStaticParams() {
  const cities = await prerenderHints("cities", getLandingCities);
  return cities.map((c) => ({ city: c.slug }));
}

/** A city that gains its first business becomes a page without a deploy. */
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: slug } = await params;
  const lang = await getLang();
  const city = await getCityBySlug(slug);
  if (!city) return notFoundMetadata(lang);

  const count = await countInCity(city.id);
  if (count < MIN_BUSINESSES) {
    return notFoundMetadata(lang);
  }

  if (lang === "en") {
    const name = city.nameEn || city.nameAr;
    return buildMetadata({
      title: `Businesses in ${name} — book online`,
      description:
        count === 1
          ? `One business in ${name} takes online bookings on Maw3ed.`
          : `${count} businesses in ${name} take online bookings on Maw3ed. See the free times and book in seconds.`,
      path: `/cities/${city.slug}`,
      lang,
    });
  }

  return buildMetadata({
    title: `أنشطة في ${city.nameAr} — احجز أونلاين`,
    description:
      count === 1
        ? `نشاط واحد في ${city.nameAr} بيستقبل حجوزات أونلاين على موعد.`
        : `${arCount(count, BIZ)} في ${city.nameAr} بيستقبلوا حجوزات أونلاين على موعد. شوف المواعيد المتاحة واحجز في ثوانٍ.`,
    path: `/cities/${city.slug}`,
  });
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;

  const [city, businesses, allCities, lang] = await Promise.all([
    getCityBySlug(slug),
    getPublishedBusinesses({ citySlug: slug }),
    // Not getCities(). A city page refuses to exist below
    // MIN_BUSINESSES, so listing every city in the table linked into a
    // 404 — five of the six shown here did. Same source as the sitemap
    // and as cityCombos below, which already got this right.
    getLandingCities(),
    getLang(),
  ]);

  // Unknown, or real but empty. Both are a 404 rather than a page
  // whose only content is that it has none.
  if (!city) notFound();
  if (businesses.length < MIN_BUSINESSES) notFound();

  const isAr = lang === "ar";
  const t = translations[lang] ?? translations.ar;
  const cityName = isAr ? city.nameAr : city.nameEn || city.nameAr;
  const otherCities = allCities.filter((c) => c.slug !== slug).slice(0, 6);

  // Only pairs that render — the same source the routes and the
  // sitemap use, so every link here leads somewhere.
  const cityCombos = (await getLandingCombos()).filter((c) => c.citySlug === slug);

  const n = businesses.length;
  const trail = [
    { name: isAr ? "الرئيسية" : "Home", path: "/" },
    { name: isAr ? "المدن" : "Cities", path: "/cities" },
    { name: cityName },
  ];
  // The ld+json tags below need this request's CSP nonce, or the
  // browser refuses to parse them.
  const nonce = await requestNonce();

  return (
    <>
      <Navbar />
      <main id="main" className="pt-16 min-h-screen bg-[var(--color-surface-2)]">

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="bg-white border-b border-[var(--color-border)]">
          <Container className="py-10">
            <Breadcrumbs
              items={trail.map((x) => ({ label: x.name, href: x.path }))}
              lang={lang}
              label={t.profile.breadcrumb}
              className="mb-3"
            />

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-brand)]/10 flex items-center justify-center shrink-0">
                <MapPin size={26} className="text-[var(--color-brand)]" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)]">
                  {isAr ? `أنشطة في ${cityName}` : `Businesses in ${cityName}`}
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {isAr
                    ? `${arCount(n, BIZ)} ${n === 2 ? "متاحين" : n > 2 && n <= 10 ? "متاحة" : "متاح"} للحجز دلوقتي`
                    : n === 1
                      ? "1 business to book now"
                      : `${n} businesses to book now`}
                </p>
              </div>
            </div>
          </Container>
        </div>

        {/* ── Business grid ─────────────────────────────────── */}
        <Container className="py-10">
          <h2 className="sr-only-label">{isAr ? "الأنشطة المتاحة" : "Available businesses"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {businesses.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/businesses"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
            >
              {isAr ? <ArrowRight size={14} aria-hidden="true" /> : <ArrowLeft size={14} aria-hidden="true" />}
              {isAr ? "عرض كل الأنشطة" : "See all businesses"}
            </Link>
          </div>

          {/* The landing pages inside this city.

              How a crawler finds /cairo/clinics at all: nothing else on
              the site links to the city-and-category pages, and a page
              that appears in the sitemap with no link pointing at it is
              a weak signal. They are also the links a reader wants —
              they came for a city and now want a kind of place in it. */}
          {cityCombos.length > 0 && (
            <div className="mt-14">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4">
                {isAr ? `تصفح حسب التخصص في ${cityName}` : `Browse by category in ${cityName}`}
              </h2>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {cityCombos.map((c) => (
                  <li key={c.categorySlug}>
                    <Link
                      href={`/${c.citySlug}/${c.categorySlug}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-[0.84375rem] text-[var(--color-muted)] transition-colors hover:border-[var(--color-jade)] hover:text-[var(--color-jade)]"
                    >
                      {isAr ? c.categoryNameAr : c.categoryNameEn || c.categoryNameAr}
                      <span className="num text-[0.75rem] text-[var(--color-subtle)]">
                        {c.count}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Other cities ──────────────────────────────── */}
          {otherCities.length > 0 && (
            <div className="mt-14">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4">
                {isAr ? "تصفح مدن أخرى" : "Other cities"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {otherCities.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/cities/${c.slug}`}
                    className="inline-flex min-h-11 items-center gap-1.5 px-4 py-2 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] font-medium hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-all"
                  >
                    <MapPin size={13} aria-hidden="true" />
                    {isAr ? c.nameAr : c.nameEn || c.nameAr}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Container>
      </main>
      <Footer />

      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(buildBreadcrumbJsonLd(trail.map((x) => ({ name: x.name, path: x.path })))),
        }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(buildItemListJsonLd(businesses.map((b) => ({ slug: b.slug, name: b.nameAr })))),
        }}
      />
    </>
  );
}

/** How many published businesses this city has. */
async function countInCity(cityId: string): Promise<number> {
  return db.business.count({ where: { isPublished: true, cityId } });
}
