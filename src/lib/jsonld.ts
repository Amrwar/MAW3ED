import { siteUrl } from "@/lib/env";
/**
 * JSON-LD structured data builders for public Maw3ed pages.
 * Returns a plain object — the caller serialises it with JSON.stringify
 * and injects it via <script type="application/ld+json">.
 */

const BASE_URL = siteUrl;

// Schema.org two-letter day codes indexed by JS getDay() (0 = Sunday)
const SCHEMA_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

export interface AvailabilityRule {
  dayOfWeek: number;   // 0–6
  openTime:  string;   // "HH:MM"
  closeTime: string;   // "HH:MM"
  isClosed:  boolean;
}

export interface ServicePrice {
  price:    number;
  currency: string;
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
  city:         { nameAr: string };
  category:     { nameAr: string };
  availability: AvailabilityRule[];
  services:     ServicePrice[];
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
