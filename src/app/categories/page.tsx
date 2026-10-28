import type { Metadata } from "next";
import { getLang } from "@/lib/lang-server";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Search } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageHero from "@/components/shared/PageHero";
import { getFacets } from "@/lib/discovery/search";
import { buildMetadata } from "@/lib/seo/meta";
import { coverClassFor } from "@/lib/category-cover";
import { translations } from "@/lib/i18n";
import { arCount, num } from "@/lib/fmt";

const BIZ = { one: "نشاط واحد", two: "نشاطين", few: "أنشطة", many: "نشاط" };

export async function generateMetadata(): Promise<Metadata> {
  const lang = await getLang();
  return lang === "en"
    ? buildMetadata({
        title: "Browse by category",
        description: "Every category with businesses taking bookings on Maw3ed — pick one and see the places in it.",
        path: "/categories",
        lang,
      })
    : buildMetadata({
        title: "تصفح حسب الفئة",
        description:
          "كل الفئات اللي فيها أنشطة بتستقبل حجوزات على موعد — اختر فئة وشوف الأماكن المتاحة فيها.",
        path: "/categories",
      });
}

/**
 * The category directory.
 *
 * This page used to be a mockup. It carried a hard-coded list of eight
 * categories — restaurants, gyms, dentists, labs, photography — none of
 * which had a single business behind them, and a table of invented
 * counts beside them: 240+ clinics, 320+ salons, 180+ restaurants,
 * 1,285+ providers in total. Anything not in that table got a number
 * from a rotating fallback array. It fetched /api/categories, a route
 * that does not exist, so the fetch 404'd and the invented list was
 * what every visitor saw.
 *
 * It now reads the same facets the browse page filters on. A category
 * appears when it has at least one published business, which is also
 * the condition for /categories/[slug] existing — so every tile leads
 * somewhere real, and the count beside it is the number of places the
 * visitor will actually find.
 */
export default async function CategoriesPage() {
  const lang = await getLang();
  const t = translations[lang] ?? translations.ar;
  const c = t.categoriesPage;
  const isAr = lang === "ar";
  const ArrowIcon = isAr ? ArrowLeft : ArrowRight;

  const facets = await getFacets();
  const categories = facets.categories.filter((cat) => cat.count > 0);

  return (
    <>
      <Navbar />
      <main id="main" className="bg-[var(--color-ground)]">
        <PageHero badge={c.eyebrow} title={c.title} subtitle={c.subtitle} />

        <section className="py-14">
          <div className="container-app">
            {categories.length === 0 ? (
              <p className="m-0 py-10 text-center text-[0.9375rem] text-[var(--color-subtle)]">
                {isAr
                  ? "لسه مفيش فئات فيها أنشطة. ارجع بص تاني قريب."
                  : "No categories have businesses yet. Check back soon."}
              </p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-2 gap-5 p-0 sm:grid-cols-3 lg:grid-cols-4">
                {categories.map((cat) => {
                  const name = isAr ? cat.nameAr : cat.nameEn || cat.nameAr;

                  return (
                    <li key={cat.id} className="min-w-0">
                      <Link
                        href={`/categories/${cat.slug}`}
                        className="card card-hover block overflow-hidden"
                      >
                        <span
                          role="img"
                          aria-label={name}
                          className={`block h-[8.5rem] ${coverClassFor(cat.slug)}`}
                        />
                        <span className="block px-5 pb-5 pt-4">
                          <span className="block truncate text-base font-bold text-[var(--color-ink)]">
                            {name}
                          </span>
                          <span className="num mt-1 block text-[0.78125rem] text-[var(--color-subtle)]">
                            {cat.count === 1
                              ? isAr
                                ? "نشاط واحد"
                                : "1 business"
                              : isAr
                                ? arCount(cat.count, BIZ)
                                : `${num(cat.count, lang)} businesses`}
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

        {/* ════════════════════════════════════════
            Bottom CTA
        ════════════════════════════════════════ */}
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
                {/* Dot-grid texture */}
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
                    <Search size={20} className="text-white" strokeWidth={1.75} />
                  </div>

                  <p
                    className="mb-1.5 text-base font-bold text-[var(--color-ink)]"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {c.notFoundTitle}
                  </p>
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
                    <ArrowIcon size={14} strokeWidth={2.5} />
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
