import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/shared/LocaleLink";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import BusinessCard from "@/components/shared/BusinessCard";
import { getCategoryBySlug, getPublishedBusinesses } from "@/lib/data";
import { MIN_BUSINESSES, getLandingCategories, prerenderHints } from "@/lib/seo/landing";
import { buildMetadata, notFoundMetadata } from "@/lib/seo/meta";
import { getLang } from "@/lib/lang-server";
import { db } from "@/lib/db";
import { arCount } from "@/lib/fmt";

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

  const [category, businesses, allCategories] = await Promise.all([
    getCategoryBySlug(slug),
    getPublishedBusinesses({ categorySlug: slug }),
    // Not getCategories(). This list links to sibling category pages,
    // and a category page refuses to exist below MIN_BUSINESSES — so
    // the full taxonomy produced links straight into a 404. Six of the
    // eight shown here did. getLandingCategories() is the same source
    // the sitemap uses: the pages that are actually there.
    getLandingCategories(),
  ]);

  if (!category) notFound();
  if (businesses.length < MIN_BUSINESSES) notFound();

  const otherCategories = allCategories.filter((c) => c.slug !== slug).slice(0, 8);

  return (
    <>
      <Navbar />
      <main id="main" className="pt-16 min-h-screen bg-[var(--color-surface-2)]">

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="bg-white border-b border-[var(--color-border)]">
          <Container className="py-10">
            {/* Breadcrumb */}
            <nav aria-label="مسار التنقل" className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-3">
              <Link href="/" className="inline-flex min-h-11 items-center hover:text-[var(--color-accent)] transition-colors">الرئيسية</Link>
              <span>/</span>
              <Link href="/businesses" className="inline-flex min-h-11 items-center hover:text-[var(--color-accent)] transition-colors">تصفح الأعمال</Link>
              <span>/</span>
              <span className="text-[var(--color-text-primary)] font-medium">{category.nameAr}</span>
            </nav>

            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-[var(--radius-lg)] flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: category.bgColor }}
              >
                {category.icon}
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-[var(--color-text-primary)]">
                  {category.nameAr}
                </h1>
                <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                  {businesses.length > 0
                    ? `${arCount(businesses.length, BIZ)} ${businesses.length === 2 ? "متاحين" : businesses.length > 2 && businesses.length <= 10 ? "متاحة" : "متاح"} للحجز دلوقتي`
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
            <EmptyState categoryName={category.nameAr} categoryIcon={category.icon} />
          )}

          {/* ── Other categories ──────────────────────────── */}
          {otherCategories.length > 0 && (
            <div className="mt-14">
              <h2 className="text-base font-bold text-[var(--color-text-primary)] mb-4">
                تصفح تخصصات أخرى
              </h2>
              <div className="flex flex-wrap gap-2">
                {otherCategories.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/categories/${c.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-[var(--radius-md)] border border-[var(--color-border)] text-sm font-medium transition-all hover:shadow-[var(--shadow-card)]"
                  >
                    <span>{c.icon}</span>
                    <span className="text-[var(--color-text-secondary)]">{c.nameAr}</span>
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

function EmptyState({ categoryName, categoryIcon }: { categoryName: string; categoryIcon: string }) {
  return (
    <div className="text-center py-24 bg-white rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <div className="text-5xl mb-4">{categoryIcon}</div>
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
        لا توجد أعمال في {categoryName} حتى الآن
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-xs mx-auto">
        كن أول من يضيف نشاطه في الفئة دي ويبدأ يستقبل حجوزات على طول.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/signup" className="btn btn-primary btn-sm">
          أضف عملك مجانًا
        </Link>
        <Link href="/businesses" className="btn btn-outline btn-sm">
          تصفح تخصصات أخرى
        </Link>
      </div>
    </div>
  );
}
