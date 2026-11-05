import { siteUrl } from "@/lib/env";
import { dialable } from "@/lib/phone";
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
  nameEn?:  string | null;
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
  city:          { nameAr: string; nameEn?: string | null };
  neighborhood?: { nameAr: string; nameEn?: string | null } | null;
  category:      { nameAr: string; nameEn?: string | null };
  availability:  AvailabilityRule[];
  services:      ServicePrice[];
  /** The owner's map pin, when they have dropped one. */
  geo?:          { latitude: number; longitude: number } | null;
  /**
   * Emitted only when reviews actually exist. Marking up a rating a
   * business has not earned is what rich-result spam policies are
   * written against, and it is the thing most likely to get a site
   * demoted rather than promoted.
   */
  rating?:       { value: number; count: number } | null;
  /**
   * The page's language. On /en the markup describes the page in English
   * (final audit F-37: it was always Arabic); the Arabic name stays as the
   * alternate. Arabic by default.
   */
  lang?:         "ar" | "en";
}

/**
 * Build a schema.org LocalBusiness JSON-LD object from real business data.
 * All optional fields are omitted when data is absent — never outputs nulls.
 */
export function buildLocalBusinessJsonLd(b: LocalBusinessInput): Record<string, unknown> {
  const en = b.lang === "en";
  const pageUrl = en ? `${BASE_URL}/en/company/${b.slug}` : `${BASE_URL}/company/${b.slug}`;
  const pick = (x: { nameAr: string; nameEn?: string | null }) => (en && x.nameEn?.trim() ? x.nameEn : x.nameAr);
  const name = en && b.nameEn?.trim() ? b.nameEn : b.nameAr;
  const alternateName = name === b.nameAr ? b.nameEn : b.nameAr;

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
    name,
    url:        pageUrl,
    address: {
      "@type":          "PostalAddress",
      addressLocality:  pick(b.city),
      addressCountry:   "EG",
      ...(b.neighborhood ? { addressRegion: pick(b.neighborhood) } : {}),
      ...(b.address ? { streetAddress: b.address } : {}),
    },
    areaServed: pick(b.city),
  };

  // Inject optional fields only when present
  if (alternateName)          jsonld.alternateName  = alternateName;
  if (description)            jsonld.description    = description;
  if (image)                  jsonld.image          = image;
  if (b.phone)                jsonld.telephone      = normalisePhone(b.phone);
  if (openingHours.length)    jsonld.openingHours   = openingHours;
  if (priceRange)             jsonld.priceRange     = priceRange;
  if (b.logoImage)            jsonld.logo           = b.logoImage;
  if (b.geo) {
    jsonld.geo = { "@type": "GeoCoordinates", latitude: b.geo.latitude, longitude: b.geo.longitude };
  }

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
        name:    en && svc.nameEn?.trim() ? svc.nameEn : svc.nameAr,
        ...(svc.duration ? { serviceOutput: `${svc.duration} min` } : {}),
      },
      price:         String(svc.price),
      priceCurrency: svc.currency,
    }));
  if (offers.length) {
    jsonld.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name:    pick(b.category),
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
  // As with the offers: a zero is a price nobody filled in, not a free
  // service. Counting it published "0 EGP" for businesses that never
  // said what they charge, and "0–500" for the rest.
  const priced = services.filter((s) => s.price > 0);
  if (!priced.length) return undefined;

  const currency = priced[0].currency;
  const prices   = priced.filter((s) => s.currency === currency).map((s) => s.price);
  const min      = Math.min(...prices);
  const max      = Math.max(...prices);

  return min === max
    ? `${min} ${currency}`
    : `${min}–${max} ${currency}`;
}

/** E.164 for schema.org telephone, from any country (src/lib/phone.ts dialable()). */
function normalisePhone(raw: string): string {
  const digits = dialable(raw);
  return digits ? `+${digits}` : raw.trim();
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

/* ─── Phase 26: organizations and venues ─────────────────────────────── */

/** A handle or a link, as an owner typed it, as a full profile URL. */
function profileUrl(base: string, value: string | null | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  if (/^https?:\/\//i.test(v)) return v;
  return `${base}/${v.replace(/^@/, "")}`;
}

/** An owner's website as an absolute URL ("example.com" → "https://example.com"); undefined if it is not one. */
function websiteUrl(value: string | null | undefined): string | undefined {
  const v = value?.trim();
  if (!v) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.hostname.includes(".") ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function hasValue<T>(v: T | undefined | null | ""): v is T {
  return v !== undefined && v !== null && v !== "";
}

/**
 * An organization page: a mall is a ShoppingCenter, anything else an
 * Organization. Only what the owner entered and the page shows — no
 * rating, no review count, no business count (the ItemList on the page
 * lists the businesses themselves).
 */
export function buildOrganizationJsonLd(o: {
  slug: string;
  kind: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr?: string | null;
  logoImage?: string | null;
  coverImage?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  city?: { nameAr: string; nameEn: string | null } | null;
  parent?: { slug: string; nameAr: string } | null;
  children?: { slug: string; nameAr: string }[];
}): Record<string, unknown> {
  const url = `${BASE_URL}/groups/${o.slug}`;
  const sameAs = [
    websiteUrl(o.website),
    profileUrl("https://instagram.com", o.instagram),
    profileUrl("https://facebook.com", o.facebook),
  ].filter(hasValue);
  const address =
    o.address || o.city
      ? {
          "@type": "PostalAddress",
          ...(o.address ? { streetAddress: o.address } : {}),
          ...(o.city ? { addressLocality: o.city.nameAr } : {}),
          addressCountry: "EG",
        }
      : undefined;
  return {
    "@context": "https://schema.org",
    "@type": o.kind === "MALL" ? "ShoppingCenter" : "Organization",
    "@id": `${url}#organization`,
    name: o.nameAr,
    ...(o.nameEn ? { alternateName: o.nameEn } : {}),
    url,
    ...(o.descriptionAr?.trim() ? { description: o.descriptionAr.trim() } : {}),
    ...(o.logoImage ? { logo: o.logoImage } : {}),
    ...(o.coverImage || o.logoImage ? { image: o.coverImage ?? o.logoImage } : {}),
    ...(o.phone ? { telephone: o.phone } : {}),
    ...(address ? { address } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(o.parent ? { parentOrganization: { "@type": "Organization", name: o.parent.nameAr, url: `${BASE_URL}/groups/${o.parent.slug}` } } : {}),
    ...(o.children?.length
      ? { subOrganization: o.children.map((c) => ({ "@type": "Organization", name: c.nameAr, url: `${BASE_URL}/groups/${c.slug}` })) }
      : {}),
  };
}

/**
 * A venue page: a mall is a ShoppingCenter, anything else a Place, with
 * the address, the pin and the weekly hours its operator set.
 */
export function buildVenueJsonLd(v: {
  slug: string;
  kind: string;
  nameAr: string;
  nameEn: string | null;
  descriptionAr?: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
  coverImage?: string | null;
  logoImage?: string | null;
  city: { nameAr: string };
  hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
}): Record<string, unknown> {
  const url = `${BASE_URL}/venues/${v.slug}`;
  const open = v.hours.filter((h) => !h.isClosed);
  return {
    "@context": "https://schema.org",
    "@type": v.kind === "MALL" ? "ShoppingCenter" : "Place",
    "@id": `${url}#place`,
    name: v.nameAr,
    ...(v.nameEn ? { alternateName: v.nameEn } : {}),
    url,
    ...(v.descriptionAr?.trim() ? { description: v.descriptionAr.trim() } : {}),
    ...(v.coverImage || v.logoImage ? { image: v.coverImage ?? v.logoImage } : {}),
    ...(v.phone ? { telephone: v.phone } : {}),
    address: {
      "@type": "PostalAddress",
      ...(v.address ? { streetAddress: v.address } : {}),
      addressLocality: v.city.nameAr,
      addressCountry: "EG",
    },
    ...(v.latitude !== null && v.longitude !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: v.latitude, longitude: v.longitude } }
      : {}),
    ...(open.length
      ? {
          openingHoursSpecification: open.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: `https://schema.org/${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][h.dayOfWeek]}`,
            opens: h.openTime,
            closes: h.closeTime,
          })),
        }
      : {}),
  };
}
