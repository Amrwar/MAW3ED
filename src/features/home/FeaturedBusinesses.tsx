import Link from "next/link";
import Container from "@/components/ui/Container";
import PublicBusinessCard from "@/components/shared/PublicBusinessCard";
import type { PublicBusiness } from "@/lib/data";
import { ArrowLeft } from "lucide-react";

interface Props {
  businesses: PublicBusiness[];
}

export default function FeaturedBusinesses({ businesses }: Props) {
  if (businesses.length === 0) return null;

  return (
    <section id="businesses" className="section-padding bg-[var(--color-surface-2)]">
      <Container>
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="section-eyebrow mb-2">الأعمال المتاحة</p>
            <h2 className="section-title">تصفح وأحجز الآن</h2>
          </div>
          <Link
            href="/businesses"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <span>عرض الكل</span>
            <ArrowLeft size={15} className="rotate-180" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {businesses.map((b) => (
            <PublicBusinessCard key={b.id} business={b} />
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Link href="/businesses" className="btn btn-outline">
            عرض جميع الأعمال
          </Link>
        </div>
      </Container>
    </section>
  );
}
