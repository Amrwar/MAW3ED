import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import Logo from "@/components/shared/Logo";
import Button from "@/components/ui/Button";
import { getBusinessBySlug } from "@/data/businesses";
import { getServicesByBusiness } from "@/data/services";
import CompanyHero from "@/features/company/CompanyHero";
import AboutSection from "@/features/company/AboutSection";
import BusinessInfoRow from "@/features/company/BusinessInfoRow";
import ServicesSection from "@/features/company/ServicesSection";
import BookingWidget from "@/features/company/BookingWidget";
import GallerySection from "@/features/company/GallerySection";
import ReviewsSection from "@/features/company/ReviewsSection";
import FAQSection from "@/features/company/FAQSection";
import SimilarBusinesses from "@/features/company/SimilarBusinesses";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const business = getBusinessBySlug(slug);
  if (!business) return { title: "غير موجود" };

  return {
    title: `${business.nameAr} — احجز موعدك`,
    description: business.taglineAr,
  };
}

export default async function CompanyPage({ params }: Params) {
  const { slug } = await params;
  const business = getBusinessBySlug(slug);

  if (!business) notFound();

  const services = getServicesByBusiness(business.id);

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="container-app h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Link href="/" className="hover:text-[var(--color-text-primary)] transition-colors">
              <Logo size="sm" />
            </Link>
            <ChevronRight size={14} className="text-[var(--color-border-2)] rotate-180" />
            <span className="text-[var(--color-text-primary)] font-medium">
              {business.nameAr}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs">
              مشاركة
            </Button>
            <Button variant="accent" size="sm">
              احجز الآن
            </Button>
          </div>
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        {/* Hero */}
        <CompanyHero business={business} />

        {/* Info row */}
        <BusinessInfoRow business={business} />

        {/* Main content + booking widget */}
        <div className="container-app py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: main content */}
            <div className="lg:col-span-2">
              <AboutSection business={business} />
              <ServicesSection services={services} />
              <GallerySection />
              <ReviewsSection
                rating={business.rating}
                reviewCount={business.reviewCount}
              />
              <FAQSection />
              <SimilarBusinesses
                currentSlug={business.slug}
                categorySlug={business.categorySlug}
              />
            </div>

            {/* Right: booking widget */}
            <div className="hidden lg:block">
              <BookingWidget
                services={services}
                businessName={business.nameAr}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 inset-x-0 z-50 lg:hidden">
        <div className="bg-white border-t border-[var(--color-border)] shadow-lg px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-xs text-[var(--color-text-muted)]">من</p>
              <p className="text-base font-black text-[var(--color-text-primary)]">
                {business.minPrice} ج.م
              </p>
            </div>
            <Button variant="accent" fullWidth className="flex-2">
              احجز موعدك الآن
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
