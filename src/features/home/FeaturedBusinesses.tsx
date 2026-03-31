import Link from "next/link";
import Container from "@/components/ui/Container";
import BusinessCard from "@/components/shared/BusinessCard";
import { getFeaturedBusinesses } from "@/data/businesses";
import { ArrowLeft } from "lucide-react";

export default function FeaturedBusinesses() {
  const businesses = getFeaturedBusinesses();

  return (
    <section id="businesses" className="section-padding bg-[var(--color-surface-2)]">
      <Container>
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="section-eyebrow mb-2">الأعمال المميزة</p>
            <h2 className="section-title">الأكثر حجزًا هذا الأسبوع</h2>
          </div>
          <Link
            href="/businesses"
            className="hidden md:flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <span>عرض الكل</span>
            <ArrowLeft size={15} className="rotate-180" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {businesses.map((business) => (
            <BusinessCard key={business.id} business={business} />
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="mt-8 text-center md:hidden">
          <Link href="/businesses" className="btn btn-outline">
            عرض جميع الأعمال
          </Link>
        </div>
      </Container>
    </section>
  );
}
