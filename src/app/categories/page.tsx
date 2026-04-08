import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Container from "@/components/ui/Container";
import { getCategories } from "@/lib/data";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "الفئات | موعد",
  description: "تصفح جميع فئات الأعمال والخدمات المتاحة على منصة موعد.",
};

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <>
      <Navbar />
      <main className="pt-16 min-h-screen">
        {/* Header */}
        <section className="bg-[var(--color-surface-2)] border-b border-[var(--color-border)] py-14">
          <Container>
            <div className="text-center max-w-xl mx-auto">
              <p className="section-eyebrow mb-2">اكتشف</p>
              <h1 className="section-title mb-4">تصفح حسب الفئة</h1>
              <p className="section-subtitle mx-auto">
                اختر الفئة التي تبحث عنها وتصفح أفضل الأعمال والخدمات المتاحة في منطقتك.
              </p>
            </div>
          </Container>
        </section>

        {/* Categories grid */}
        <section className="section-padding">
          <Container>
            {categories.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                {categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/businesses?category=${cat.slug}`}
                    className="card p-6 flex flex-col items-center text-center hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200 group"
                  >
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform duration-200"
                      style={{ backgroundColor: cat.bgColor ?? "#F3F4F6" }}
                    >
                      {cat.icon}
                    </div>
                    <h2 className="font-bold text-[var(--color-text-primary)]">
                      {cat.nameAr}
                    </h2>
                  </Link>
                ))}
              </div>
            ) : (
              /* Fallback static categories from data file */
              <StaticCategoriesGrid />
            )}
          </Container>
        </section>

        {/* CTA */}
        <section className="section-padding bg-[var(--color-surface-2)]">
          <Container>
            <div className="text-center max-w-lg mx-auto">
              <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
                لم تجد ما تبحث عنه؟
              </h2>
              <p className="text-[var(--color-text-secondary)] mb-6">
                تصفح جميع الأعمال أو ابحث بالاسم مباشرة.
              </p>
              <Link href="/businesses" className="btn btn-primary btn-lg">
                تصفح جميع الأعمال
              </Link>
            </div>
          </Container>
        </section>
      </main>
      <Footer />
    </>
  );
}

// Fallback when DB returns empty (seeding / local dev)
function StaticCategoriesGrid() {
  const staticCats = [
    { slug: "clinics",     nameAr: "عيادات",       icon: "🏥", bgColor: "#F0F9FF", count: 340 },
    { slug: "salons",      nameAr: "صالونات",       icon: "✂️", bgColor: "#FDF2F8", count: 218 },
    { slug: "restaurants", nameAr: "مطاعم",         icon: "🍽️", bgColor: "#FFFBEB", count: 195 },
    { slug: "gyms",        nameAr: "جيم وفيتنس",    icon: "💪", bgColor: "#ECFDF5", count: 127 },
    { slug: "spas",        nameAr: "سبا وتدليك",    icon: "🧖", bgColor: "#F5F3FF", count: 89  },
    { slug: "dentists",    nameAr: "طب أسنان",      icon: "🦷", bgColor: "#ECFEFF", count: 156 },
    { slug: "labs",        nameAr: "مختبرات",       icon: "🔬", bgColor: "#FEF2F2", count: 74  },
    { slug: "photography", nameAr: "تصوير",         icon: "📸", bgColor: "#FFF7ED", count: 63  },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {staticCats.map((cat) => (
        <Link
          key={cat.slug}
          href={`/businesses?category=${cat.slug}`}
          className="card p-6 flex flex-col items-center text-center hover:border-[var(--color-accent)] hover:shadow-md transition-all duration-200 group"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 shadow-sm group-hover:scale-110 transition-transform duration-200"
            style={{ backgroundColor: cat.bgColor }}
          >
            {cat.icon}
          </div>
          <h2 className="font-bold text-[var(--color-text-primary)] mb-1">
            {cat.nameAr}
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">
            {cat.count}+ نشاط
          </p>
        </Link>
      ))}
    </div>
  );
}
