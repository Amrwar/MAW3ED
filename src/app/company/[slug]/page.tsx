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
import { siteUrl } from "@/lib/env";

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

  const baseUrl   = siteUrl;
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
    coverImage:   dbBusiness.coverImage ?? undefined,
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
      <header className="sticky top-0 z-50 border-b border-[var(--color-line)] bg-[var(--color-ground)]/95 backdrop-blur-md">
        <div className="container-app flex h-16 items-center justify-between gap-5">
          <nav aria-label="مسار التصفح" className="flex min-w-0 items-center gap-2.5">
            <Link href="/" className="shrink-0">
              <Logo size="sm" />
            </Link>
            <ChevronRight
              size={14}
              aria-hidden="true"
              className="shrink-0 text-[var(--color-faint)]"
              style={{ transform: "scaleX(-1)" }}
            />
            <span
              className="truncate text-sm font-bold text-[var(--color-ink)] max-w-[180px] md:max-w-xs"
              title={business.nameAr}
            >
              {business.nameAr}
            </span>
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" className="btn btn-outline btn-sm hidden sm:inline-flex">
              <Share2 size={14} strokeWidth={1.8} aria-hidden="true" />
              مشاركة
            </button>
            <a href="#booking" className="btn btn-primary btn-sm btn-pill">
              احجز الآن
            </a>
          </div>
        </div>
      </header>

      <main className="bg-[var(--color-ground)]">
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
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-line)] bg-[var(--color-surface)]/98 backdrop-blur-md lg:hidden">
        <div className="container-app flex items-center gap-4 py-3">
          {!!minPrice && (
            <div className="min-w-0 flex-1">
              <p className="m-0 text-xs leading-none text-[var(--color-subtle)]">يبدأ من</p>
              <p className="num m-0 mt-1.5 text-lg font-extrabold leading-none text-[var(--color-ink)]">
                {minPrice.toLocaleString("ar-EG-u-nu-latn")} ج.م
              </p>
            </div>
          )}
          <a href="#booking" className="btn btn-primary flex-1">
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
