import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { MapPin } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageHero from "@/components/shared/PageHero";
import { getFacets } from "@/lib/discovery/search";
import { buildMetadata } from "@/lib/seo/meta";
import { translations, type Lang } from "@/lib/i18n";
import { arCount, num } from "@/lib/fmt";

const BIZ = { one: "نشاط واحد", two: "نشاطين", few: "أنشطة", many: "نشاط" };

export const metadata: Metadata = buildMetadata({
  title: "تصفح حسب المدينة",
  description:
    "المدن اللي فيها أنشطة بتستقبل حجوزات على موعد — اختر مدينتك وشوف الأماكن القريبة منك.",
  path: "/cities",
});

/**
 * The city directory.
 *
 * Like the category page, this was a mockup. It listed twenty
 * governorates from a hard-coded array — Minya, Sohag, Qena, Aswan,
 * New Valley and the rest — and linked each one to a free-text search
 * for its own name, so sixteen of the twenty led to an empty results
 * page. It fetched /api/cities first, a route that does not exist, so
 * the hard-coded list was always what shipped.
 *
 * It now lists the cities that actually have published businesses, and
 * links to /cities/[slug], which exists under exactly that condition.
 */
export default async function CitiesPage() {
  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;
  const c = t.citiesPage;
  const isAr = lang === "ar";

  const facets = await getFacets();
  const cities = facets.cities.filter((city) => city.count > 0);

  return (
    <>
      <Navbar />
      <main id="main" className="bg-[var(--color-ground)]">
        <PageHero
          badge={c.eyebrow}
          title={c.title}
          subtitle={c.subtitle}
          dir={isAr ? "rtl" : "ltr"}
        />

        <section className="py-14">
          <div className="container-app">
            {cities.length === 0 ? (
              <p className="m-0 py-10 text-center text-[0.9375rem] text-[var(--color-subtle)]">
                {isAr
                  ? "لسه مفيش مدن فيها أنشطة. ارجع بص تاني قريب."
                  : "No cities have businesses yet. Check back soon."}
              </p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-2 gap-3.5 p-0 sm:grid-cols-3 lg:grid-cols-4">
                {cities.map((city) => {
                  const name = isAr ? city.nameAr : city.nameEn || city.nameAr;

                  return (
                    <li key={city.id} className="min-w-0">
                      <Link
                        href={`/cities/${city.slug}`}
                        className="card card-hover flex min-h-[4.5rem] items-center gap-3.5 px-5"
                      >
                        <span
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-jade-soft)]"
                        >
                          <MapPin size={19} strokeWidth={1.8} className="text-[var(--color-jade)]" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[0.9375rem] font-bold text-[var(--color-ink)]">
                            {name}
                          </span>
                          <span className="num block text-[0.75rem] text-[var(--color-subtle)]">
                            {city.count === 1
                              ? isAr
                                ? "نشاط واحد"
                                : "1 business"
                              : isAr
                                ? arCount(city.count, BIZ)
                                : `${num(city.count, lang)} businesses`}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="py-12 lg:py-16">
          <div className="container-app">
            <div className="mx-auto max-w-lg">
              <div
                className="relative overflow-hidden rounded-[var(--radius-xl)] p-5 text-center sm:p-8"
                style={{
                  background: "linear-gradient(135deg, rgba(14,127,94,0.06) 0%, rgba(14,127,94,0.04) 100%)",
                  border:     "1px solid rgba(14,127,94,0.18)",
                  boxShadow:  "0 2px 16px rgba(14,127,94,0.07)",
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage: "radial-gradient(circle, rgba(14,127,94,0.07) 1px, transparent 1px)",
                    backgroundSize:  "20px 20px",
                  }}
                />
                <div className="relative z-10">
                  <div
                    className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)]"
                    style={{
                      background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                      boxShadow:  "0 4px 14px rgba(14,127,94,0.35)",
                    }}
                  >
                    <MapPin size={20} className="text-white" strokeWidth={1.75} />
                  </div>
                  <p className="mb-1.5 text-base font-bold text-[var(--color-ink)]">{c.notFoundTitle}</p>
                  <p className="mb-6 text-sm text-[var(--color-muted)]" style={{ lineHeight: 1.7 }}>
                    {c.notFoundSub}
                  </p>
                  <Link
                    href="/businesses"
                    className="inline-flex items-center gap-2 rounded-[var(--radius-lg)] px-7 py-3 text-sm font-bold text-white transition-shadow duration-200 hover:shadow-[var(--shadow-raised)]"
                    style={{
                      background: "linear-gradient(135deg, var(--color-jade) 0%, var(--color-jade) 100%)",
                      boxShadow:  "0 4px 16px rgba(14,127,94,0.40)",
                    }}
                  >
                    {c.viewAll}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
