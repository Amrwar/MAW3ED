import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { MapPin, ArrowRight, Building2 } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import BusinessCard from "@/components/shared/BusinessCard";
import { getCityBySlug, getPublishedBusinesses } from "@/lib/data";
import { MIN_BUSINESSES, getLandingCities, getLandingCombos, prerenderHints } from "@/lib/seo/landing";
import { buildMetadata } from "@/lib/seo/meta";
import { db } from "@/lib/db";

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
  const city = await getCityBySlug(slug);
  if (!city) return { title: "غير موجود", robots: { index: false, follow: false } };

  const count = await countInCity(city.id);
  if (count < MIN_BUSINESSES) {
    return { title: "غير موجود", robots: { index: false, follow: false } };
  }

  return buildMetadata({
    title: `أعمال في ${city.nameAr} — احجز أونلاين`,
    description:
      count === 1
        ? `نشاط واحد في ${city.nameAr} بيستقبل حجوزات أونلاين على موعد.`
        : `${count} نشاط في ${city.nameAr} بيستقبلوا حجوزات أونلاين على موعد. شوف المواعيد المتاحة واحجز في ثوانٍ.`,
    path: `/cities/${city.slug}`,
  });
}

export default async function CityPage({ params }: Props) {
  const { city: slug } = await params;

  const [city, businesses, allCities] = await Promise.all([
    getCityBySlug(slug),
    getPublishedBusinesses({ citySlug: slug }),
    // Not getCities(). A city page refuses to exist below
    // MIN_BUSINESSES, so listing every city in the table linked into a
    // 404 — five of the six shown here did. Same source as the sitemap
    // and as cityCombos below, which already got this right.
    getLandingCities(),
  ]);

  // Unknown, or real but empty. Both are a 404 rather than a page
  // whose only content is that it has none.
  if (!city) notFound();
  if (businesses.length < MIN_BUSINESSES) notFound();

  const otherCities = allCities.filter((c) => c.slug !== slug).slice(0, 6);

  // Only pairs that render — the same source the routes and the
  // sitemap use, so every link here leads somewhere.
  const cityCombos = (await getLandingCombos()).filter((c) => c.citySlug === slug);

  return (
    <>
      <Navbar />
      <main id="main" className="pt-16 min-h-screen bg-[var(--color-surface-2)]">

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="bg-white border-b border-[var(--color-border)]">
          <Container className="py-10">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-6">
              <Link href="/" className="hover:text-[var(--color-accent)] transition-colors">الرئيسية</Link>
              <span>/</span>
              <Link href="/businesses" className="hover:text-[var(--color-accent)] transition-colors">تصفح الأعمال</Link>
              <span>/</span>
              <span className="text-[var(--color-text-primary)] font-medium">{city.nameAr}</span>
            </nav>

            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[var(--radius-lg)] bg-[var(--color-brand)]/10 flex items-center justify-center shrink-0">
                <MapPin size={26} className="text-[var(--color-brand)]" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)]">
                  أعمال في {city.nameAr}
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {businesses.length > 0
                    ? `${businesses.length} عمل متاح للحجز الآن`
                    : "لا توجد أعمال حتى الآن"}
                </p>
              </div>
            </div>
          </Container>
        </div>

        {/* ── Business grid ─────────────────────────────────── */}
        <Container className="py-10">
          {businesses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {businesses.map((b) => (
                  <BusinessCard key={b.id} business={b} />
                ))}
              </div>

              <div className="mt-8 text-center">
                <Link
                  href="/businesses"
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                >
                  <ArrowRight size={14} />
                  عرض كل الأعمال
                </Link>
              </div>
            </>
          ) : (
            <EmptyState cityName={city.nameAr} />
          )}

          {/* The landing pages inside this city.

              How a crawler finds /cairo/clinics at all: nothing else on
              the site links to the city-and-category pages, and a page
              that appears in the sitemap with no link pointing at it is
              a weak signal. They are also the links a reader wants —
              they came for a city and now want a kind of place in it. */}
          {cityCombos.length > 0 && (
            <div className="mt-14">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4">
                تصفح حسب التخصص في {city.nameAr}
              </h2>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {cityCombos.map((c) => (
                  <li key={c.categorySlug}>
                    <Link
                      href={`/${c.citySlug}/${c.categorySlug}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-4 text-[0.84375rem] text-[var(--color-muted)] transition-colors hover:border-[var(--color-jade)] hover:text-[var(--color-jade)]"
                    >
                      {c.categoryNameAr}
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
                تصفح مدن أخرى
              </h2>
              <div className="flex flex-wrap gap-2">
                {otherCities.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/cities/${c.slug}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm text-[var(--color-text-secondary)] font-medium hover:border-[var(--color-brand)] hover:text-[var(--color-brand)] transition-all"
                  >
                    <MapPin size={13} />
                    {c.nameAr}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Container>
      </main>
      <Footer />
    </>
  );
}

// ─── Empty state ──────────────────────────────────────────

function EmptyState({ cityName }: { cityName: string }) {
  return (
    <div className="text-center py-24 bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-surface-2)] flex items-center justify-center mx-auto mb-4">
        <Building2 size={28} className="text-[var(--color-text-muted)]" />
      </div>
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
        لا توجد أعمال في {cityName} حتى الآن
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-xs mx-auto">
        كن أول من يضيف عمله في {cityName} ويبدأ باستقبال حجوزات على الفور.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/signup" className="btn btn-primary btn-sm">
          أضف عملك مجانًا
        </Link>
        <Link href="/businesses" className="btn btn-outline btn-sm">
          تصفح مدن أخرى
        </Link>
      </div>
    </div>
  );
}

/** How many published businesses this city has. */
async function countInCity(cityId: string): Promise<number> {
  return db.business.count({ where: { isPublished: true, cityId } });
}
