import type { Metadata } from "next";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { resolveSource } from "@/lib/attribution/source";
import { OWN_HOSTS } from "@/lib/attribution/hosts";
import RecordView from "@/features/company/RecordView";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import Logo from "@/components/shared/Logo";
import Breadcrumbs, { breadcrumbJsonLd, type Crumb } from "@/components/shared/Breadcrumbs";
import ProfileHeader from "@/features/company/ProfileHeader";
import CompanyContent from "@/features/company/CompanyContent";
import StickyBookingBar from "@/features/company/StickyBookingBar";
import type { Business } from "@/types/business";
import type { Service } from "@/types/service";
import { buildLocalBusinessJsonLd } from "@/lib/jsonld";
import { siteUrl } from "@/lib/env";
import { getPublishedBusinesses } from "@/lib/data";
import { cairoNow, openState, type DayHours } from "@/lib/discovery/hours";
import { findNextSlot } from "@/lib/discovery/next-slot";
import { timeToMinutes } from "@/lib/bookings/time";
import { getBusinessReviews, getRatingSummary } from "@/lib/reviews";
import { translations, type Lang } from "@/lib/i18n";

interface Params {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;

  const biz = await db.business.findUnique({
    where:  { slug, isPublished: true },
    select: {
      nameAr:      true,
      nameEn:      true,
      taglineAr:   true,
      about:       true,
      coverImage:  true,
      logoImage:   true,
      ratingAvg:   true,
      ratingCount: true,
      city:         { select: { nameAr: true } },
      neighborhood: { select: { nameAr: true } },
      category:     { select: { nameAr: true } },
    },
  });

  if (!biz) return { title: "غير موجود", robots: { index: false, follow: false } };

  const pageUrl = `${siteUrl}/company/${slug}`;
  const place = biz.neighborhood ? `${biz.neighborhood.nameAr}، ${biz.city.nameAr}` : biz.city.nameAr;

  // No brand suffix here: the root layout's title template already
  // appends "| موعد MAW3ED", and adding one too produced
  // "… | موعد | موعد MAW3ED" on every page of the site.
  const title = `${biz.nameAr} — ${biz.category.nameAr} في ${place}`;

  // Description, in order of how much it actually says about the place:
  // the owner's tagline, then their own words, then a sentence built
  // from what is on file. Nothing is invented at any step.
  const description =
    biz.taglineAr?.trim() ||
    (biz.about?.trim()
      ? biz.about.trim().slice(0, 155) + (biz.about.trim().length > 155 ? "…" : "")
      : `احجز موعدك في ${biz.nameAr} — ${biz.category.nameAr} في ${place}. شوف الخدمات والأسعار والمواعيد المتاحة واحجز أونلاين.`);

  const ogImage = biz.coverImage ?? biz.logoImage;
  const ogImages = ogImage
    ? [{ url: ogImage, width: 1200, height: 630, alt: biz.nameAr }]
    : [];

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: "website",
      title,
      description,
      url: pageUrl,
      siteName: "موعد",
      locale: "ar_EG",
      images: ogImages,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
}

export default async function CompanyPage({ params, searchParams }: Params) {
  const { slug } = await params;

  // Where this visitor came from, decided here rather than in the
  // browser: the Referer header is only readable on the server, and the
  // ?src= on the link is what the business meant whatever the browser
  // reports. The value is handed to two places — a beacon that counts
  // the view, and the booking widget, so a booking carries the channel
  // that produced it instead of it being inferred from timing.
  const sp = await searchParams;
  const srcParam = typeof sp.src === "string" ? sp.src : null;
  const requestHeaders = await headers();
  const source = resolveSource({
    src: srcParam,
    referrer: requestHeaders.get("referer"),
    ownHosts: OWN_HOSTS,
  });

  const dbBusiness = await db.business.findUnique({
    where:   { slug, isPublished: true },
    include: {
      category:     true,
      city:         true,
      neighborhood: true,
      services:     { where: { isAvailable: true }, orderBy: { sortOrder: "asc" } },
      branches:     { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      availability: { orderBy: { dayOfWeek: "asc" } },
      images:       { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!dbBusiness) notFound();

  const cookieStore = await cookies();
  const lang = (cookieStore.get("maw3ed-lang")?.value ?? "ar") as Lang;
  const t = translations[lang] ?? translations.ar;

  const [resourcesRaw, staffRaw, summary, reviewPage, bookings] = await Promise.all([
    // Every business, not only restaurants: a clinic schedules rooms, a
    // gym schedules equipment, a salon schedules chairs. What is offered
    // follows from what the business has configured, never from its
    // category — the same rule the dashboard and the availability engine
    // already follow.
    db.resource.findMany({
      where:   { businessId: dbBusiness.id, isActive: true },
      select:  {
        id: true, name: true, kind: true, capacity: true,
        area: true, notes: true, photo: true,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    db.staffMember.findMany({
      where:   { businessId: dbBusiness.id, isActive: true },
      select:  { id: true, nameAr: true, nameEn: true, role: true, photo: true, services: { select: { serviceId: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // The one rating calculation. Nothing on this page computes its own.
    getRatingSummary(dbBusiness.id),
    getBusinessReviews(dbBusiness.id, { sort: "recent", take: 10 }),
    db.booking.findMany({
      where: {
        businessId: dbBusiness.id,
        status: { in: ["PENDING", "CONFIRMED"] },
        date: { gte: startOfCairoDay() },
      },
      select: { date: true, startTime: true, endTime: true, service: { select: { duration: true } } },
    }),
  ]);

  const similarBusinesses = (
    await getPublishedBusinesses({ categorySlug: dbBusiness.category.slug, take: 4 })
  )
    .filter((b) => b.slug !== slug)
    .slice(0, 3);

  const hours: DayHours[] = dbBusiness.availability.map((a) => ({
    dayOfWeek: a.dayOfWeek,
    openTime:  a.openTime,
    closeTime: a.closeTime,
    isClosed:  a.isClosed,
  }));

  // Opening state on the Cairo clock. This page used to compute it from
  // the server's own time, which on Vercel is UTC — two or three hours
  // out, so a business could be reported shut while its doors were open.
  const { dayOfWeek, time } = cairoNow();
  const open = openState(hours, dayOfWeek, time);

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

  // The first genuinely free appointment, by the same rule the booking
  // widget applies — not simply the next time the doors open.
  const todayUTC = startOfCairoDay();
  const shortest = services.reduce<number | null>(
    (min, s) => (s.duration > 0 && (min === null || s.duration < min) ? s.duration : min),
    null,
  );
  const nextSlot = findNextSlot(
    {
      rules: hours,
      durationMinutes: shortest,
      booked: bookings.map((b) => {
        const startMin = timeToMinutes(b.startTime);
        return {
          dayOffset: Math.round((b.date.getTime() - todayUTC.getTime()) / 86_400_000),
          startMin,
          endMin: b.endTime ? timeToMinutes(b.endTime) : startMin + b.service.duration,
        };
      }),
    },
    dayOfWeek,
    time,
  );

  const business: Business = {
    id:           dbBusiness.id,
    slug:         dbBusiness.slug,
    nameAr:       dbBusiness.nameAr,
    nameEn:       dbBusiness.nameEn ?? "",
    taglineAr:    dbBusiness.taglineAr ?? "",
    category:     dbBusiness.category.nameAr,
    categorySlug: dbBusiness.category.slug,
    // Read, never asserted. This was hardcoded to 4.8 against an empty
    // reviews table on every profile the site served.
    rating:       summary.average ?? 0,
    reviewCount:  summary.count,
    location:     dbBusiness.city.nameAr,
    locationAr:   dbBusiness.city.nameAr,
    address:      dbBusiness.address ?? undefined,
    phone:        dbBusiness.phone ?? undefined,
    whatsapp:     dbBusiness.whatsapp ?? undefined,
    coverImage:   dbBusiness.coverImage ?? undefined,
    logoImage:    dbBusiness.logoImage ?? undefined,
    isVerified:   dbBusiness.isVerified,
    isOpen:       open.state === "open",
    about:        dbBusiness.about ?? undefined,
    hours: dbBusiness.availability.map((a) => ({
      day:    EN_DAYS[a.dayOfWeek] ?? "",
      dayAr:  AR_DAYS[a.dayOfWeek] ?? "",
      open:   a.openTime,
      close:  a.closeTime,
      closed: a.isClosed,
    })),
  };

  const crumbs: Crumb[] = [
    { label: lang === "ar" ? "الرئيسية" : "Home", href: "/" },
    {
      label: lang === "ar" ? dbBusiness.category.nameAr : dbBusiness.category.nameEn,
      href: `/businesses?category=${dbBusiness.category.slug}`,
    },
    {
      label: lang === "ar" ? dbBusiness.city.nameAr : dbBusiness.city.nameEn,
      href: `/businesses?city=${dbBusiness.city.slug}`,
    },
    { label: lang === "en" && dbBusiness.nameEn ? dbBusiness.nameEn : dbBusiness.nameAr },
  ];

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
    neighborhood: dbBusiness.neighborhood,
    category:     dbBusiness.category,
    availability: dbBusiness.availability,
    services:     dbBusiness.services.map((s) => ({
      nameAr:   s.nameAr,
      price:    Number(s.price),
      currency: s.currency,
      duration: s.duration,
    })),
    // Only emitted when real. Marking up a rating that does not exist
    // is exactly what rich-result spam policies are written against.
    rating: summary.count > 0 && summary.average !== null
      ? { value: summary.average, count: summary.count }
      : null,
  });

  const pricedServices = services.filter((s) => s.price > 0);
  const minPrice = pricedServices.length > 0 ? Math.min(...pricedServices.map((s) => s.price)) : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd(crumbs, siteUrl)) }}
      />

      {/* ── Top bar ── */}
      {/* Dark, like the navbar on every other page. This bar is the
          profile's own rather than the shared Navbar, so it does not
          follow it automatically — and a white bar here against a dark
          one everywhere else is the kind of seam that makes a product
          feel assembled from parts. */}
      <header className="sticky top-0 z-50 border-b border-[var(--color-night-line)] bg-[var(--color-night)]/95 backdrop-blur-md">
        <div className="container-app flex h-16 items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-3">
            {/* Logo renders its own link to "/", so wrapping it in
                another produced an <a> inside an <a>: invalid HTML, and
                React threw a hydration error on every load of this
                page. */}
            <Logo size="sm" variant="white" className="shrink-0" />
            <Breadcrumbs
              items={crumbs}
              lang={lang}
              label={t.profile.breadcrumb}
              className="hidden sm:block"
              onDark
            />
          </div>

          <a href="#booking" className="btn btn-primary btn-sm btn-pill shrink-0">
            {t.profile.bookNow}
          </a>
        </div>
      </header>

      <main id="main" className="bg-[var(--color-ground)]">
        {/* The trail again on a phone, where it does not fit in the bar. */}
        <div className="container-app pt-3 sm:hidden">
          <Breadcrumbs items={crumbs} lang={lang} label={t.profile.breadcrumb} />
        </div>

        <ProfileHeader
          business={{
            id:               dbBusiness.id,
            slug:             dbBusiness.slug,
            nameAr:           dbBusiness.nameAr,
            nameEn:           dbBusiness.nameEn,
            categoryName:     lang === "ar" ? dbBusiness.category.nameAr : dbBusiness.category.nameEn,
            categorySlug:     dbBusiness.category.slug,
            cityName:         lang === "ar" ? dbBusiness.city.nameAr : dbBusiness.city.nameEn,
            neighborhoodName: dbBusiness.neighborhood
              ? lang === "ar" ? dbBusiness.neighborhood.nameAr : dbBusiness.neighborhood.nameEn
              : null,
            address:          dbBusiness.address,
            phone:            dbBusiness.phone,
            whatsapp:         dbBusiness.whatsapp,
            coverImage:       dbBusiness.coverImage,
            logoImage:        dbBusiness.logoImage,
            isVerified:       dbBusiness.isVerified,
            open,
          }}
          summary={summary}
        />

        {/* Counts the visit from the browser, so a crawler rendering
            this page does not look like a customer. Anonymous: the
            channel and the day, nothing about who. */}
        <RecordView slug={slug} source={source} />

        <CompanyContent
          business={business}
          source={source}
          services={services}
          openDays={dbBusiness.availability.filter((a) => !a.isClosed).map((a) => a.dayOfWeek)}
          slug={slug}
          similarBusinesses={similarBusinesses}
          businessType={dbBusiness.businessType as "GENERAL" | "RESTAURANT" | "BARBERSHOP"}
          resources={resourcesRaw}
          staffMembers={staffRaw.map((s) => ({
            id:         s.id,
            nameAr:     s.nameAr,
            nameEn:     s.nameEn,
            role:       s.role,
            photo:      s.photo,
            serviceIds: s.services.map((ss) => ss.serviceId),
          }))}
          hours={hours}
          images={dbBusiness.images.map((i) => ({ id: i.id, url: i.url, caption: i.caption }))}
          summary={summary}
          reviews={reviewPage.reviews}
          reviewsMatched={reviewPage.matched}
          neighborhoodName={
            dbBusiness.neighborhood
              ? lang === "ar" ? dbBusiness.neighborhood.nameAr : dbBusiness.neighborhood.nameEn
              : null
          }
          nextSlot={nextSlot}
          branches={dbBusiness.branches.map((b) => ({ id: b.id, nameAr: b.nameAr, address: b.address }))}
          depositEnabled={dbBusiness.depositEnabled}
          depositPercent={dbBusiness.depositPercent}
        />
      </main>

      <StickyBookingBar
        minPrice={minPrice}
        currency={services[0]?.currency ?? "EGP"}
        open={open}
        watchId="profile-actions"
      />
    </>
  );
}

/* ─── Helpers ──────────────────────────────────────────────── */

/** Midnight today in Cairo, expressed the way bookings are stored. */
function startOfCairoDay(now: Date = new Date()): Date {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .split("-")
    .map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
