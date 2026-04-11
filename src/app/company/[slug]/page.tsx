import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Share2 } from "lucide-react";
import { db } from "@/lib/db";
import Logo from "@/components/shared/Logo";
import CompanyHero from "@/features/company/CompanyHero";
import BusinessInfoRow from "@/features/company/BusinessInfoRow";
import CompanyContent from "@/features/company/CompanyContent";
import type { Business } from "@/types/business";
import type { Service } from "@/types/service";
import type { PublicBusiness } from "@/lib/data";
import { buildLocalBusinessJsonLd } from "@/lib/jsonld";

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

  if (!biz) return { title: "غير موجود | موعد" };

  const baseUrl   = (process.env.AUTH_URL ?? "https://maw3ed.net").replace(/\/$/, "");
  const pageUrl   = `${baseUrl}/company/${slug}`;
  const title     = `${biz.nameAr} | حجز موعد في ${biz.city.nameAr} | موعد`;
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
    openGraph: { title, description, url: pageUrl, siteName: "موعد", locale: "ar_EG", type: "website", images: ogImages },
    twitter: { card: biz.coverImage ? "summary_large_image" : "summary", title, description, ...(biz.coverImage ? { images: [biz.coverImage] } : {}) },
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

  // Fetch resource data based on businessType
  const [tablesRaw, staffRaw] = await Promise.all([
    dbBusiness.businessType === "RESTAURANT"
      ? db.table.findMany({
          where:   { businessId: dbBusiness.id, isActive: true },
          select:  { id: true, name: true, tableType: true, capacity: true, notes: true, photo: true },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
    dbBusiness.businessType === "BARBERSHOP"
      ? db.staffMember.findMany({
          where:   { businessId: dbBusiness.id, isActive: true },
          select:  { id: true, nameAr: true, nameEn: true, role: true, photo: true, services: { select: { serviceId: true } } },
          orderBy: { createdAt: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const similarRows = await db.business.findMany({
    where: { isPublished: true, slug: { not: slug }, categoryId: dbBusiness.categoryId },
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
      services:   { where: { isAvailable: true }, orderBy: { price: "asc" }, take: 1, select: { price: true, currency: true } },
    },
    take: 3,
    orderBy: { createdAt: "desc" },
  });

  const similarBusinesses: PublicBusiness[] = similarRows.map((b) => ({
    ...b,
    minPrice: b.services[0] ? Number(b.services[0].price) : null,
    currency: b.services[0]?.currency ?? "EGP",
  }));

  const business: Business = {
    id:           dbBusiness.id,
    slug:         dbBusiness.slug,
    nameAr:       dbBusiness.nameAr,
    nameEn:       dbBusiness.nameEn ?? "",
    taglineAr:    dbBusiness.taglineAr ?? "",
    category:     dbBusiness.category.nameAr,
    categorySlug: dbBusiness.category.slug,
    rating:       4.8,
    reviewCount:  0,
    location:     dbBusiness.city.nameAr,
    locationAr:   dbBusiness.city.nameAr,
    address:      dbBusiness.address ?? undefined,
    phone:        dbBusiness.phone ?? undefined,
    whatsapp:     dbBusiness.whatsapp ?? undefined,
    coverImage:   dbBusiness.coverImage ??
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80",
    logoImage:    dbBusiness.logoImage ?? undefined,
    isVerified:   dbBusiness.isVerified,
    isOpen:       isOpenNow(dbBusiness.availability),
    about:        dbBusiness.about ?? undefined,
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

  const jsonLd = buildLocalBusinessJsonLd({
    slug:         dbBusiness.slug,
    nameAr:       dbBusiness.nameAr,
    nameEn:       dbBusiness.nameEn,
    about:        dbBusiness.about,
    taglineAr:    dbBusiness.taglineAr,
    phone:        dbBusiness.phone,
    coverImage:   dbBusiness.coverImage,
    logoImage:    dbBusiness.logoImage,
    address:      dbBusiness.address,
    city:         dbBusiness.city,
    category:     dbBusiness.category,
    availability: dbBusiness.availability,
    services:     dbBusiness.services.map((s) => ({ price: Number(s.price), currency: s.currency })),
  });

  const minPrice = services.length > 0 ? Math.min(...services.map((s) => s.price)) : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Sticky top navbar ── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          background:   "rgba(255,255,255,0.97)",
          backdropFilter: "blur(16px)",
          borderColor:  "#E2E8F0",
          boxShadow:    "0 1px 8px rgba(15,23,42,0.06)",
        }}
      >
        <div className="container-app h-16 flex items-center justify-between gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
              <Logo size="sm" />
            </Link>
            <ChevronRight size={14} className="text-[#CBD5E1] shrink-0" style={{ transform: "scaleX(-1)" }} />
            <span
              className="text-sm font-semibold text-[#0F172A] truncate max-w-[180px] md:max-w-xs"
              title={business.nameAr}
            >
              {business.nameAr}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-[#475569] border border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:text-[#1D4ED8] transition-all duration-200"
            >
              <Share2 size={14} />
              مشاركة
            </button>
            <a
              href="#booking"
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-bold text-white transition-all duration-200"
              style={{
                background:  "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
                boxShadow:   "0 2px 12px rgba(59,130,246,0.35)",
              }}
            >
              احجز الآن
            </a>
          </div>
        </div>
      </header>

      <main style={{ background: "#F8FAFC" }}>
        <CompanyHero business={business} />
        <BusinessInfoRow business={business} />
        <CompanyContent
          business={business}
          services={services}
          openDays={openDays}
          slug={slug}
          similarBusinesses={similarBusinesses}
          businessType={dbBusiness.businessType as "GENERAL" | "RESTAURANT" | "BARBERSHOP"}
          tables={tablesRaw}
          staffMembers={staffRaw.map((s) => ({
            id:         s.id,
            nameAr:     s.nameAr,
            nameEn:     s.nameEn,
            role:       s.role,
            photo:      s.photo,
            serviceIds: s.services.map((ss) => ss.serviceId),
          }))}
        />
      </main>

      {/* ── Mobile sticky bottom CTA ── */}
      <div
        className="fixed bottom-0 inset-x-0 z-50 lg:hidden"
        style={{
          background:  "rgba(255,255,255,0.98)",
          backdropFilter: "blur(16px)",
          borderTop:   "1px solid #E2E8F0",
          boxShadow:   "0 -4px 24px rgba(15,23,42,0.08)",
        }}
      >
        <div className="container-app py-3 flex items-center gap-3">
          {minPrice !== null && (
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#94A3B8] leading-none mb-1">يبدأ من</p>
              <p className="text-lg font-black text-[#0F172A] leading-none">
                {minPrice.toLocaleString("ar-EG")} ج.م
              </p>
            </div>
          )}
          <a
            href="#booking"
            className="flex-1 flex items-center justify-center py-3 rounded-2xl text-sm font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)",
              boxShadow:  "0 4px 16px rgba(59,130,246,0.35)",
            }}
          >
            احجز موعدك الآن
          </a>
        </div>
      </div>
    </>
  );
}

// ─── Helpers ──────────────────────────────────────────────

function isOpenNow(
  availability: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>,
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
