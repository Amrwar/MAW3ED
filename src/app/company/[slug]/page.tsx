import type { Metadata } from "next";
import { jsonLdScript } from "@/lib/seo/jsonld-script";
import { resolveSource } from "@/lib/attribution/source";
import { OWN_HOSTS } from "@/lib/attribution/hosts";
import RecordView from "@/features/company/RecordView";
import { notFound } from "next/navigation";
import { isOwnerPreview } from "@/lib/business/preview";
import PreviewBanner from "@/features/company/PreviewBanner";
import Link from "@/components/shared/LocaleLink";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { headers } from "next/headers";
import { requestNonce } from "@/lib/security/nonce";
import { db } from "@/lib/db";
import Logo from "@/components/shared/Logo";
import Breadcrumbs, { breadcrumbJsonLd, type Crumb } from "@/components/shared/Breadcrumbs";
import ProfileHeader from "@/features/company/ProfileHeader";
import CompanyContent from "@/features/company/CompanyContent";
import StickyBookingBar from "@/features/company/StickyBookingBar";
import type { Business } from "@/types/business";
import type { Service } from "@/types/service";
import { buildLocalBusinessJsonLd } from "@/lib/jsonld";
import { cdnShareImage } from "@/lib/cdn-image";
import { siteUrl } from "@/lib/env";
import { venuesOfBusiness } from "@/lib/venues/public";
import { organizationsOfBusiness } from "@/lib/organizations/public";
import { getLang } from "@/lib/lang-server";
import { alternatesFor, DEFAULT_OG_IMAGE, ogLocale } from "@/lib/seo/meta";
import { getPublishedBusinesses } from "@/lib/data";
import { cairoNow, openState, type DayHours } from "@/lib/discovery/hours";
import { businessNextSlot } from "@/lib/discovery/profile";
import { getBusinessReviews, getRatingSummary } from "@/lib/reviews";
import { translations } from "@/lib/i18n";

interface Params {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;

  const found = await db.business.findUnique({
    where:  { slug },
    select: {
      isPublished: true,
      ownerId:     true,
      nameAr:      true,
      nameEn:      true,
      taglineAr:   true,
      about:       true,
      coverImage:  true,
      logoImage:   true,
      ratingAvg:   true,
      ratingCount: true,
      city:         { select: { nameAr: true, nameEn: true } },
      neighborhood: { select: { nameAr: true, nameEn: true } },
      category:     { select: { nameAr: true, nameEn: true } },
    },
  });

  // An unpublished business exists only for its owner's preview, and a
  // preview is never indexed.
  const preview = found ? await isOwnerPreview(found) : false;
  const biz = found && (found.isPublished || preview) ? found : null;

  const lang = await getLang();
  const en = lang === "en";
  if (!biz) return { title: en ? "Not found" : "غير موجود", robots: { index: false, follow: false } };
  if (preview) return { title: `${en ? "Preview" : "معاينة"} — ${biz.nameAr}`, robots: { index: false, follow: false } };

  const alternates = alternatesFor(`/company/${slug}`, lang);
  const canonical = String(alternates.canonical);
  // The page's language for everything Maw3ed writes; the owner's own
  // words (tagline, about) stay as they wrote them.
  const name = en && biz.nameEn ? biz.nameEn : biz.nameAr;
  const city = en ? biz.city.nameEn : biz.city.nameAr;
  const hood = biz.neighborhood ? (en ? biz.neighborhood.nameEn : biz.neighborhood.nameAr) : null;
  const category = en ? biz.category.nameEn : biz.category.nameAr;
  const place = hood ? `${hood}${en ? ", " : "، "}${city}` : city;

  // No brand suffix here: the root layout's title template already
  // appends "| موعد MAW3ED", and adding one too produced
  // "… | موعد | موعد MAW3ED" on every page of the site.
  const title = en ? `${name} — ${category} in ${place}` : `${name} — ${category} في ${place}`;

  // Description, in order of how much it actually says about the place:
  // the owner's tagline, then their own words, then a sentence built
  // from what is on file. Nothing is invented at any step.
  const description =
    biz.taglineAr?.trim() ||
    (biz.about?.trim()
      ? biz.about.trim().slice(0, 155) + (biz.about.trim().length > 155 ? "…" : "")
      : en
        ? `Book at ${name} — ${category} in ${place}. See the services, prices and free times and book online.`
        : `احجز موعدك في ${name} — ${category} في ${place}. شوف الخدمات والأسعار والمواعيد المتاحة واحجز أونلاين.`);

  const uploaded = biz.coverImage ?? biz.logoImage;
  // Cropped to the size declared below; anything not on Cloudinary
  // passes through as it was.
  const ogImage = uploaded ? cdnShareImage(uploaded) : null;
  const ogImages = ogImage
    ? [{ url: ogImage, width: 1200, height: 630, alt: name }]
    : [{ url: DEFAULT_OG_IMAGE.url, ...DEFAULT_OG_IMAGE.size, alt: name }];

  return {
    title,
    description,
    alternates,
    openGraph: {
      type: "website",
      title,
      description,
      url: canonical,
      siteName: "موعد · Maw3ed",
      locale: ogLocale(lang),
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage ?? DEFAULT_OG_IMAGE.url],
    },
  };
}

export default async function CompanyPage({ params, searchParams }: Params) {
  // The nonce for this request's CSP; the ld+json tags below carry it
  // or the browser refuses to parse them.
  const nonce = await requestNonce();

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
    where:   { slug },
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
  // Not published: only its owner sees it, as a private preview with a
  // banner, and can try a test booking through the real widget.
  const preview = await isOwnerPreview(dbBusiness);
  if (!dbBusiness.isPublished && !preview) notFound();

  const lang = await getLang();
  const t = translations[lang] ?? translations.ar;

  // The public venues and organizations this business is listed in
  // (approved rows only) — fetched together: these are independent of
  // each other and sit on the hottest public page.
  const [venueRows, orgRows] = await Promise.all([
    venuesOfBusiness(dbBusiness.id).catch(() => []),
    organizationsOfBusiness(dbBusiness.id).catch(() => []),
  ]);
  const venueLinks = venueRows.map((m) => ({
    slug: m.venue.slug,
    name: lang === "en" ? m.venue.nameEn || m.venue.nameAr : m.venue.nameAr,
    zone: m.zone ? (lang === "en" ? m.zone.nameEn || m.zone.nameAr : m.zone.nameAr) : null,
    unit: m.unit,
  }));

  const orgLinks = orgRows.map((o) => ({
    slug: o.slug,
    name: lang === "en" ? o.nameEn || o.nameAr : o.nameAr,
  }));
  const fromOrganization =
    typeof sp.org === "string" && orgLinks.some((o) => o.slug === sp.org) ? sp.org : null;

  const [resourcesRaw, staffRaw, summary, reviewPage, nextSlot] = await Promise.all([
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
    // The first genuinely free appointment, by the same rule the booking
    // widget applies — not simply the next time the doors open. Shared
    // with the app's business screen (src/lib/discovery/profile.ts).
    businessNextSlot(dbBusiness.id, dbBusiness.services),
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
    locationEn:   dbBusiness.city.nameEn ?? undefined,
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
    geo:
      dbBusiness.latitude != null && dbBusiness.longitude != null
        ? { latitude: dbBusiness.latitude, longitude: dbBusiness.longitude }
        : null,
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
      {preview && <PreviewBanner lang={lang} />}
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
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
            {/* A way back on a phone, where the breadcrumbs are not in
                the bar. To the list, not history.back(): a visitor
                arriving from a shared link has no history here. */}
            <Link
              href="/businesses"
              aria-label={lang === "ar" ? "رجوع لتصفح الأنشطة" : "Back to browse"}
              className="-ms-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--color-night-text)] hover:bg-white/10 sm:hidden"
            >
              {lang === "ar" ? <ArrowRight size={20} aria-hidden="true" /> : <ArrowLeft size={20} aria-hidden="true" />}
            </Link>
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
          <Breadcrumbs items={crumbs} lang={lang} label={t.profile.breadcrumb} singleLine />
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
          changeCutoffHours={dbBusiness.cancellationCutoffHours}
          initialServiceId={typeof sp.service === "string" ? sp.service : null}
          initialStaffId={typeof sp.staff === "string" ? sp.staff : null}
          initialBranchId={typeof sp.branch === "string" ? sp.branch : null}
          venues={venueLinks}
          organizations={orgLinks}
          fromOrganization={fromOrganization}
        />
      </main>

      <StickyBookingBar
        minPrice={minPrice}
        currency={services[0]?.currency ?? "EGP"}
        open={open}
        watchIds={["profile-actions", "booking"]}
      />
    </>
  );
}

/* ─── Helpers ──────────────────────────────────────────────── */

const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
