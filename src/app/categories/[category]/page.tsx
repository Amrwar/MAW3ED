import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import BusinessCard from "@/components/shared/BusinessCard";
import Breadcrumbs from "@/components/shared/Breadcrumbs";
import { getCategoryBySlug, getPublishedBusinesses } from "@/lib/data";
import { MIN_BUSINESSES, getLandingCategories, prerenderHints } from "@/lib/seo/landing";
import { buildMetadata, notFoundMetadata } from "@/lib/seo/meta";
import { getLang } from "@/lib/lang-server";
import { db } from "@/lib/db";
import { arCount } from "@/lib/fmt";
import { translations } from "@/lib/i18n";
import { buildBreadcrumbJsonLd, buildItemListJsonLd } from "@/lib/jsonld";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { requestNonce } from "@/lib/security/nonce";

const BIZ = { one: "نشاط واحد", two: "نشاطين", few: "أنشطة", many: "نشاط" };

type Props = { params: Promise<{ category: string }> };

export async function generateStaticParams() {
  // Ten of the fourteen categories have no business in them. Those are
  // not pages; they are an empty grid with a heading over it.
  const categories = await prerenderHints("categories", getLandingCategories);
  return categories.map((c) => ({ category: c.slug }));
}

export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const lang = await getLang();
  const category = await getCategoryBySlug(slug);
  if (!category) return notFoundMetadata(lang);

  const count = await db.business.count({
    where: { isPublished: true, categoryId: category.id },
  });
  if (count < MIN_BUSINESSES) {
    return notFoundMetadata(lang);
  }

  if (lang === "en") {
    const name = category.nameEn || category.nameAr;
    return buildMetadata({
      title: `${name} — book online`,
      description:
        count === 1
          ? `One business in ${name} takes online bookings on Maw3ed.`
          : `${count} businesses in ${name} take online bookings on Maw3ed. Compare and book in seconds.`,
      path: `/categories/${category.slug}`,
      lang,
    });
  }

  return buildMetadata({
    title: `${category.nameAr} — احجز أونلاين`,
    description:
      count === 1
        ? `نشاط واحد في ${category.nameAr} بيستقبل حجوزات أونلاين على موعد.`
        : `${arCount(count, BIZ)} في ${category.nameAr} بيستقبلوا حجوزات أونلاين على موعد. قارن واحجز في ثوانٍ.`,
    path: `/categories/${category.slug}`,
  });
}

export default async function CategoryPage({ params }: Props) {
  const { category: slug } = await params;

  const [category, businesses, allCategories, lang] = await Promise.all([
    getCategoryBySlug(slug),
    getPublishedBusinesses({ categorySlug: slug }),
    // Not getCategories(). This list links to sibling category pages,
    // and a category page refuses to exist below MIN_BUSINESSES — so
    // the full taxonomy produced links straight into a 404. Six of the
    // eight shown here did. getLandingCategories() is the same source
    // the sitemap uses: the pages that are actually there.
    getLandingCategories(),
    getLang(),
  ]);

  if (!category) notFound();
  if (businesses.length < MIN_BUSINESSES) notFound();

  const isAr = lang === "ar";
  const t = translations[lang] ?? translations.ar;
  const name = isAr ? category.nameAr : category.nameEn || category.nameAr;
  const otherCategories = allCategories.filter((c) => c.slug !== slug).slice(0, 8);

  const n = businesses.length;
  const trail = [
    { name: isAr ? "الرئيسية" : "Home", path: "/" },
    { name: isAr ? "الأقسام" : "Categories", path: "/categories" },
    { name },
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
              <div
                aria-hidden="true"
                className="w-14 h-14 rounded-[var(--radius-lg)] flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: category.bgColor }}
              >
                {category.icon}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)]">
                  {name}
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

          {/* ── Other categories ──────────────────────────── */}
          {otherCategories.length > 0 && (
            <div className="mt-14">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4">
                {isAr ? "تصفح تخصصات أخرى" : "Other categories"}
              </h2>
              <div className="flex flex-wrap gap-2">
                {otherCategories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/categories/${c.slug}`}
                    className="inline-flex min-h-11 items-center gap-2 px-4 py-2 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm font-medium transition-all hover:shadow-[var(--shadow-card)]"
                  >
                    <span aria-hidden="true">{c.icon}</span>
                    <span className="text-[var(--color-text-secondary)]">{isAr ? c.nameAr : c.nameEn || c.nameAr}</span>
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
