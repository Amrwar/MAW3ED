import Link from "next/link";
import Container from "@/components/ui/Container";
import { ArrowLeft } from "lucide-react";

type DbCategory = {
  id:      string;
  slug:    string;
  nameAr:  string;
  nameEn:  string;
  icon:    string;
  color:   string;
  bgColor: string;
};

interface Props {
  categories: DbCategory[];
}

export default function CategoriesSection({ categories }: Props) {
  return (
    <section className="section-padding">
      <Container>
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

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/businesses?category=${cat.slug}`}
              className="group flex flex-col items-center gap-3 p-5 rounded-xl border border-[var(--color-border)] bg-white hover:shadow-md hover:border-[var(--color-accent)]/30 transition-all duration-200"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-200 group-hover:scale-110"
                style={{ backgroundColor: cat.bgColor }}
              >
                {cat.icon}
              </div>
              <p className="font-semibold text-sm text-center text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors leading-tight">
                {cat.nameAr}
              </p>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
