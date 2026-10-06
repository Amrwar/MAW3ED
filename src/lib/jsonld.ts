import { siteUrl } from "@/lib/env";
/**
 * JSON-LD structured data builders for public Maw3ed pages.
 * Returns a plain object — the caller serialises it with JSON.stringify
 * and injects it via <script type="application/ld+json">.
 */

const BASE_URL = siteUrl;

// Schema.org two-letter day codes indexed by JS getDay() (0 = Sunday)
const SCHEMA_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

/** The same days spelled out, for openingHoursSpecification. */
const SCHEMA_FULL_DAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

export interface AvailabilityRule {
  dayOfWeek: number;   // 0–6
  openTime:  string;   // "HH:MM"
  closeTime: string;   // "HH:MM"
  isClosed:  boolean;
}

export interface ServicePrice {
  nameAr?:  string;
  price:    number;
  currency: string;
  duration?: number;
}

export interface LocalBusinessInput {
  slug:         string;
  nameAr:       string;
  nameEn:       string | null;
  about:        string | null;
  taglineAr:    string | null;
  phone:        string | null;
  coverImage:   string | null;
  logoImage:    string | null;
  address:      string | null;
  city:          { nameAr: string };
  neighborhood?: { nameAr: string } | null;
  category:      { nameAr: string };
  availability:  AvailabilityRule[];
  services:      ServicePrice[];
  /**
   * Emitted only when reviews actually exist. Marking up a rating a
   * business has not earned is what rich-result spam policies are
   * written against, and it is the thing most likely to get a site
   * demoted rather than promoted.
   */
  rating?:       { value: number; count: number } | null;
}

/**
 * Build a schema.org LocalBusiness JSON-LD object from real business data.
 * All optional fields are omitted when data is absent — never outputs nulls.
 */
export function buildLocalBusinessJsonLd(b: LocalBusinessInput): Record<string, unknown> {
  const pageUrl = `${BASE_URL}/company/${b.slug}`;

  // Description: about → tagline → omit
  const description = b.about?.trim() || b.taglineAr?.trim() || undefined;

  // Image: cover preferred, logo fallback, omit if neither
  const image = b.coverImage ?? b.logoImage ?? undefined;

  // Opening hours: one entry per open day, e.g. "Mo 09:00-21:00"
  const openingHours = b.availability
    .filter((a) => !a.isClosed)
    .map((a) => `${SCHEMA_DAYS[a.dayOfWeek]} ${a.openTime}-${a.closeTime}`);

  // Price range: "min – max EGP", or single price if uniform, omit if no services
  const priceRange = buildPriceRange(b.services);

  const jsonld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type":    "LocalBusiness",
    name:       b.nameAr,
    url:        pageUrl,
    address: {
      "@type":          "PostalAddress",
      addressLocality:  b.city.nameAr,
      addressCountry:   "EG",
      ...(b.neighborhood ? { addressRegion: b.neighborhood.nameAr } : {}),
      ...(b.address ? { streetAddress: b.address } : {}),
    },
    areaServed: b.city.nameAr,
  };

  // Inject optional fields only when present
  if (b.nameEn)               jsonld.alternateName  = b.nameEn;
  if (description)            jsonld.description    = description;
  if (image)                  jsonld.image          = image;
  if (b.phone)                jsonld.telephone      = normalisePhone(b.phone);
  if (openingHours.length)    jsonld.openingHours   = openingHours;
  if (priceRange)             jsonld.priceRange     = priceRange;
  if (b.logoImage)            jsonld.logo           = b.logoImage;

  // openingHoursSpecification carries the same hours in the structured
  // form, which is what Google actually reads for an hours panel.
  const spec = b.availability
    .filter((a) => !a.isClosed)
    .map((a) => ({
      "@type":     "OpeningHoursSpecification",
      dayOfWeek:   `https://schema.org/${SCHEMA_FULL_DAYS[a.dayOfWeek]}`,
      opens:       a.openTime,
      closes:      a.closeTime,
    }));
  if (spec.length) jsonld.openingHoursSpecification = spec;

  // The menu, as an offer catalogue. Only services with a real price
  // get one — a zero is an empty field, not a free service.
  const offers = b.services
    .filter((svc) => svc.nameAr && svc.price > 0)
    .map((svc) => ({
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name:    svc.nameAr,
        ...(svc.duration ? { serviceOutput: `${svc.duration} min` } : {}),
      },
      price:         String(svc.price),
      priceCurrency: svc.currency,
    }));
  if (offers.length) {
    jsonld.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name:    b.category.nameAr,
      itemListElement: offers,
    };
  }

  if (b.rating && b.rating.count > 0) {
    jsonld.aggregateRating = {
      "@type":      "AggregateRating",
      ratingValue:  b.rating.value,
      reviewCount:  b.rating.count,
      bestRating:   5,
      worstRating:  1,
    };
  }

  return jsonld;
}

// ─── Helpers ──────────────────────────────────────────────

function buildPriceRange(services: ServicePrice[]): string | undefined {
  if (!services.length) return undefined;

  const prices   = services.map((s) => s.price);
  const currency = services[0].currency;
  const min      = Math.min(...prices);
  const max      = Math.max(...prices);

  return min === max
    ? `${min} ${currency}`
    : `${min}–${max} ${currency}`;
}

/** Normalise to E.164-ish format for schema.org telephone */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0"))  return `+20${digits.slice(1)}`;
  if (digits.startsWith("20")) return `+${digits}`;
  return `+20${digits}`;
}

/* ─── Breadcrumbs ─────────────────────────────────────────── */

/**
 * BreadcrumbList for a landing page.
 *
 * Google shows these as the path under a result instead of a bare URL,
 * which is most of the value of having landing pages at all: "موعد ›
 * القاهرة › عيادات طبية" reads as a place in a structure rather than
 * as a guess.
 *
 * Positions are 1-based and the last item is the current page, which
 * carries no URL of its own — a self-link in a breadcrumb is noise.
 */
export function buildBreadcrumbJsonLd(
  trail: { name: string; path?: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      ...(step.path ? { item: `${BASE_URL}${step.path}` } : {}),
    })),
  };
}

/**
 * ItemList for a landing page's results.
 *
 * Says "this page lists these businesses, in this order" rather than
 * leaving a crawler to infer it from the markup. Only the businesses
 * actually on the page, so it never claims more than it shows.
 */
export function buildItemListJsonLd(
  items: { slug: string; name: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${BASE_URL}/company/${b.slug}`,
      name: b.name,
    })),
  };
}
