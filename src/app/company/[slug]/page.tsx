import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import Logo from "@/components/shared/Logo";
import Button from "@/components/ui/Button";
import CompanyHero from "@/features/company/CompanyHero";
import AboutSection from "@/features/company/AboutSection";
import BusinessInfoRow from "@/features/company/BusinessInfoRow";
import ServicesSection from "@/features/company/ServicesSection";
import BookingWidget from "@/features/company/BookingWidget";
import GallerySection from "@/features/company/GallerySection";
import ReviewsSection from "@/features/company/ReviewsSection";
import FAQSection from "@/features/company/FAQSection";
import SimilarBusinesses from "@/features/company/SimilarBusinesses";
import type { Business } from "@/types/business";
import type { Service } from "@/types/service";

interface Params { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const biz = await db.business.findUnique({
    where:  { slug, isPublished: true },
    select: { nameAr: true, taglineAr: true },
  });
  if (!biz) return { title: "غير موجود" };
  return {
    title:       `${biz.nameAr} — احجز موعدك`,
    description: biz.taglineAr ?? undefined,
  };
}

export default async function CompanyPage({ params }: Params) {
  const { slug } = await params;

  const dbBusiness = await db.business.findUnique({
    where:   { slug, isPublished: true },
    include: {
      category:     true,
      city:         true,
      services:     { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } },
      availability: { orderBy: { dayOfWeek: "asc" } },
      _count:       { select: { bookings: true } },
    },
  });

  if (!dbBusiness) notFound();

  // Map DB model → UI types so existing components continue to work
  const business: Business = {
    id:           dbBusiness.id,
    slug:         dbBusiness.slug,
    nameAr:       dbBusiness.nameAr,
    nameEn:       dbBusiness.nameEn ?? "",
    taglineAr:    dbBusiness.taglineAr ?? "",
    category:     dbBusiness.category.nameAr,
    categorySlug: dbBusiness.category.slug,
    rating:       4.8,           // placeholder until reviews are built (step 3)
    reviewCount:  0,
    location:     dbBusiness.city.nameAr,
    locationAr:   dbBusiness.city.nameAr,
    address:      dbBusiness.address ?? undefined,
    phone:        dbBusiness.phone ?? undefined,
    whatsapp:     dbBusiness.whatsapp ?? undefined,
    coverImage:   dbBusiness.coverImage ?? "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
    isVerified:   dbBusiness.isVerified,
    isOpen:       isOpenNow(dbBusiness.availability),
    about:        dbBusiness.about ?? undefined,
    hours: dbBusiness.availability.map((a) => ({
      day:      dayName(a.dayOfWeek),
      dayAr:    dayNameAr(a.dayOfWeek),
      open:     a.openTime,
      close:    a.closeTime,
      closed:   a.isClosed,
    })),
  };

  const services: Service[] = dbBusiness.services.map((s) => ({
    id:            s.id,
    businessId:    s.businessId,
    nameAr:        s.nameAr,
    nameEn:        s.nameEn ?? undefined,
    descriptionAr: s.descriptionAr ?? undefined,
    duration:      s.duration,
    price:         Number(s.price),
    currency:      s.currency,
    isAvailable:   s.isAvailable,
  }));

  return (
    <>
      {/* Compact top navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[var(--color-border)]">
        <div className="container-app h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <Link href="/" className="hover:text-[var(--color-text-primary)] transition-colors">
              <Logo size="sm" />
            </Link>
            <ChevronRight size={14} className="text-[var(--color-border-2)] rotate-180" />
            <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[160px]">
              {business.nameAr}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs">مشاركة</Button>
            <Button variant="accent" size="sm">احجز الآن</Button>
          </div>
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        <CompanyHero business={business} />
        <BusinessInfoRow business={business} />

        <div className="container-app py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main content */}
            <div className="lg:col-span-2">
              <AboutSection business={business} />
              <ServicesSection services={services} />
              <GallerySection />
              <ReviewsSection rating={business.rating} reviewCount={business.reviewCount} />
              <FAQSection />
              <SimilarBusinesses
                currentSlug={business.slug}
                categorySlug={business.categorySlug}
              />
            </div>

            {/* Booking widget */}
            <div className="hidden lg:block">
              <BookingWidget services={services} businessName={business.nameAr} />
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
                {services.length > 0
                  ? `${Math.min(...services.map((s) => s.price))} ج.م`
                  : "—"}
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

// ─── Helpers ──────────────────────────────────────────────

function isOpenNow(availability: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>) {
  const now        = new Date();
  const dayOfWeek  = now.getDay();
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const rule = availability.find((a) => a.dayOfWeek === dayOfWeek);
  if (!rule || rule.isClosed) return false;

  const [oh, om] = rule.openTime.split(":").map(Number);
  const [ch, cm] = rule.closeTime.split(":").map(Number);
  return currentMin >= oh * 60 + om && currentMin < ch * 60 + cm;
}

const EN_DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const AR_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];

function dayName(d: number) { return EN_DAYS[d] ?? ""; }
function dayNameAr(d: number) { return AR_DAYS[d] ?? ""; }
