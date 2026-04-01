import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import Logo from "@/components/shared/Logo";
import Button from "@/components/ui/Button";
import CompanyHero from "@/features/company/CompanyHero";
import BusinessInfoRow from "@/features/company/BusinessInfoRow";
import CompanyContent from "@/features/company/CompanyContent";
import type { Business } from "@/types/business";
import type { Service } from "@/types/service";
import type { PublicBusiness } from "@/lib/data";

interface Params { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;

  const biz = await db.business.findUnique({
    where:  { slug, isPublished: true },
    select: {
      nameAr:     true,
      taglineAr:  true,
      about:      true,
      coverImage: true,
      city:       { select: { nameAr: true } },
      category:   { select: { nameAr: true } },
    },
  });

  // Unpublished or missing — return minimal metadata; page itself will 404
  if (!biz) return { title: "غير موجود | موعد" };

  const baseUrl   = (process.env.AUTH_URL ?? "https://maw3ed.app").replace(/\/$/, "");
  const pageUrl   = `${baseUrl}/company/${slug}`;

  const title = `${biz.nameAr} | حجز موعد في ${biz.city.nameAr} | موعد`;

  // Description priority: tagline → about (truncated) → generated fallback
  const description =
    biz.taglineAr?.trim() ||
    (biz.about?.trim()
      ? biz.about.trim().slice(0, 150) + (biz.about.trim().length > 150 ? "…" : "")
      : `احجز موعدك في ${biz.nameAr} — ${biz.category.nameAr} في ${biz.city.nameAr}. حجز سريع وسهل عبر منصة موعد.`);

  const ogImages = biz.coverImage
    ? [{ url: biz.coverImage, width: 1200, height: 630, alt: biz.nameAr }]
    : [];

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      title,
      description,
      url:      pageUrl,
      siteName: "موعد",
      locale:   "ar_EG",
      type:     "website",
      images:   ogImages,
    },
    twitter: {
      card:        biz.coverImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(biz.coverImage ? { images: [biz.coverImage] } : {}),
    },
  };
}

export default async function CompanyPage({ params }: Params) {
  const { slug } = await params;

  const [dbBusiness, similarRaw] = await Promise.all([
    db.business.findUnique({
      where:   { slug, isPublished: true },
      include: {
        category:     true,
        city:         true,
        services:     { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } },
        availability: { orderBy: { dayOfWeek: "asc" } },
        _count:       { select: { bookings: true } },
      },
    }),
    // Fetched after we know the category — resolved below
    Promise.resolve(null as null),
  ]);

  if (!dbBusiness) notFound();

  // Fetch similar businesses (same category, different slug, published)
  const similarRows = await db.business.findMany({
    where: {
      isPublished: true,
      slug:        { not: slug },
      categoryId:  dbBusiness.categoryId,
    },
    select: {
      id:         true,
      slug:       true,
      nameAr:     true,
      nameEn:     true,
      taglineAr:  true,
      coverImage: true,
      logoImage:  true,
      isVerified: true,
      category:   { select: { nameAr: true, icon: true, color: true, bgColor: true, slug: true } },
      city:       { select: { nameAr: true } },
      services:   {
        where:   { isAvailable: true },
        orderBy: { price: "asc" },
        take:    1,
        select:  { price: true, currency: true },
      },
    },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  const similarBusinesses: PublicBusiness[] = similarRows.map((b) => ({
    ...b,
    minPrice: b.services[0] ? Number(b.services[0].price) : null,
    currency: b.services[0]?.currency ?? "EGP",
  }));

  // Map DB → UI types
  const business: Business = {
    id:          dbBusiness.id,
    slug:        dbBusiness.slug,
    nameAr:      dbBusiness.nameAr,
    nameEn:      dbBusiness.nameEn ?? "",
    taglineAr:   dbBusiness.taglineAr ?? "",
    category:    dbBusiness.category.nameAr,
    categorySlug: dbBusiness.category.slug,
    rating:      4.8,
    reviewCount: 0,
    location:    dbBusiness.city.nameAr,
    locationAr:  dbBusiness.city.nameAr,
    address:     dbBusiness.address ?? undefined,
    phone:       dbBusiness.phone ?? undefined,
    whatsapp:    dbBusiness.whatsapp ?? undefined,
    coverImage:  dbBusiness.coverImage ??
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
    isVerified:  dbBusiness.isVerified,
    isOpen:      isOpenNow(dbBusiness.availability),
    about:       dbBusiness.about ?? undefined,
    hours: dbBusiness.availability.map((a) => ({
      day:    dayName(a.dayOfWeek),
      dayAr:  dayNameAr(a.dayOfWeek),
      open:   a.openTime,
      close:  a.closeTime,
      closed: a.isClosed,
    })),
  };

  const openDays: number[] = dbBusiness.availability
    .filter((a) => !a.isClosed)
    .map((a) => a.dayOfWeek);

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
            <ChevronRight size={14} className="text-[var(--color-border)] rotate-180" />
            <span className="text-[var(--color-text-primary)] font-medium truncate max-w-[160px]">
              {business.nameAr}
            </span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-xs">مشاركة</Button>
            <a href="#booking">
              <Button variant="accent" size="sm">احجز الآن</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="pb-24 md:pb-0">
        <CompanyHero business={business} />
        <BusinessInfoRow business={business} />

        <div className="container-app py-8">
          <CompanyContent
            business={business}
            services={services}
            openDays={openDays}
            slug={slug}
            similarBusinesses={similarBusinesses}
          />
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
            <a href="#booking" className="flex-1">
              <Button variant="accent" fullWidth>
                احجز موعدك الآن
              </Button>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────

function isOpenNow(
  availability: Array<{
    dayOfWeek: number;
    openTime:  string;
    closeTime: string;
    isClosed:  boolean;
  }>,
) {
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

function dayName(d: number)   { return EN_DAYS[d] ?? ""; }
function dayNameAr(d: number) { return AR_DAYS[d] ?? ""; }
