import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Layers } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import PublicBusinessCard from "@/components/shared/PublicBusinessCard";
import { getCategories, getCategoryBySlug, getPublishedBusinesses } from "@/lib/data";

type Props = { params: Promise<{ category: string }> };

export async function generateStaticParams() {
  const categories = await getCategories();
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  return {
    title: `${category.nameAr} | تصفح الأعمال | موعد`,
    description: `اكتشف أفضل أعمال ${category.nameAr} واحجز موعدك بسهولة عبر موعد.`,
    openGraph: {
      title: `${category.icon} ${category.nameAr} | موعد`,
      description: `اكتشف أفضل أعمال ${category.nameAr} واحجز موعدك بسهولة.`,
    },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category: slug } = await params;

  const [category, businesses, allCategories] = await Promise.all([
    getCategoryBySlug(slug),
    getPublishedBusinesses({ categorySlug: slug }),
    getCategories(),
  ]);

  if (!category) notFound();

  const otherCategories = allCategories.filter((c) => c.slug !== slug).slice(0, 8);

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen bg-[var(--color-surface-2)]">

        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="bg-white border-b border-[var(--color-border)]">
          <Container className="py-10">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] mb-6">
              <Link href="/" className="hover:text-[var(--color-accent)] transition-colors">الرئيسية</Link>
              <span>/</span>
              <Link href="/businesses" className="hover:text-[var(--color-accent)] transition-colors">تصفح الأعمال</Link>
              <span>/</span>
              <span className="text-[var(--color-text-primary)] font-medium">{category.nameAr}</span>
            </nav>

            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                style={{ backgroundColor: category.bgColor }}
              >
                {category.icon}
              </div>
              <div>
                <h1 className="text-2xl font-black text-[var(--color-text-primary)]">
                  {category.nameAr}
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
                  <PublicBusinessCard key={b.id} business={b} />
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
                    key={c.id}
                    href={`/categories/${c.slug}`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-[var(--color-border)] text-sm font-medium transition-all hover:shadow-sm"
                    style={{ color: c.color }}
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
    <div className="text-center py-24 bg-white rounded-2xl border border-[var(--color-border)]">
      <div className="text-5xl mb-4">{categoryIcon}</div>
      <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">
        لا توجد أعمال في {categoryName} حتى الآن
      </h2>
      <p className="text-sm text-[var(--color-text-muted)] mb-6 max-w-xs mx-auto">
        كن أول من يضيف عملك في هذا التخصص ويبدأ باستقبال حجوزات على الفور.
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
