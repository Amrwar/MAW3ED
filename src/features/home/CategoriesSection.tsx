import Link from "next/link";
import Container from "@/components/ui/Container";
import { categories } from "@/data/categories";
import { ArrowLeft } from "lucide-react";

export default function CategoriesSection() {
  return (
    <section className="section-padding">
      <Container>
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="section-eyebrow mb-2">الأقسام</p>
            <h2 className="section-title">تصفح حسب التخصص</h2>
          </div>
          <Link
            href="/businesses"
            className="flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <span>عرض الكل</span>
            <ArrowLeft size={15} className="rotate-180" />
          </Link>
        </div>

        {/* Categories grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/?category=${cat.slug}`}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border border-[var(--color-border)] bg-white hover:border-current hover:shadow-md transition-all duration-200"
              style={{ "--hover-color": cat.color } as React.CSSProperties}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: cat.bgColor }}
              >
                {cat.icon}
              </div>
              <div className="text-center">
                <p className="font-semibold text-sm text-[var(--color-text-primary)] group-hover:text-inherit transition-colors">
                  {cat.nameAr}
                </p>
                {cat.count && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    {cat.count}+ عمل
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
