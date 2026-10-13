import { config } from "@/lib/config";
import type { DayHours, PublicProfile, PublicResource, PublicStaffMember } from "@/types/api";

/**
 * What a business profile shows, and in what words, decided from what
 * the business is and what it has actually set up.
 *
 * A clinic's people are doctors with specialties; a salon's are a team
 * you pick from; a restaurant is tables, seats and branches. They share
 * one data shape but not one page. Nothing here invents content: a kind
 * only changes order and vocabulary, and every section still needs real
 * data to appear.
 */

export type ProfileKind = "clinic" | "team" | "dining" | "general";

const MEDICAL = new Set(["clinics", "dentists", "labs", "medical", "hospitals", "physiotherapy", "pharmacies"]);
const DINING = new Set(["restaurants", "cafes", "dining"]);
const TEAM = new Set(["salons", "barbers", "barbershops", "beauty-centers", "spas"]);

export function profileKind(p: Pick<PublicProfile, "businessType" | "category" | "staff">): ProfileKind {
  const cats = [p.category.slug, p.category.parentSlug].filter((x): x is string => Boolean(x));
  if (p.businessType === "RESTAURANT" || cats.some((c) => DINING.has(c))) return "dining";
  if (cats.some((c) => MEDICAL.has(c))) return "clinic";
  if (p.businessType === "BARBERSHOP" || cats.some((c) => TEAM.has(c)) || p.staff.length > 0) return "team";
  return "general";
}

type Words = { ar: string; en: string };

export interface KindWords {
  people: Words;
  services: Words;
  book: Words;
}

export const KIND_WORDS: Record<ProfileKind, KindWords> = {
  clinic: {
    people: { ar: "الأطباء والأخصائيين", en: "Doctors & specialists" },
    services: { ar: "الكشوفات والخدمات", en: "Appointments & services" },
    book: { ar: "احجز كشف", en: "Book appointment" },
  },
  team: {
    people: { ar: "الفريق", en: "The team" },
    services: { ar: "الخدمات", en: "Services" },
    book: { ar: "احجز موعد", en: "Book" },
  },
  dining: {
    people: { ar: "الفريق", en: "The team" },
    services: { ar: "أنواع الحجز", en: "Reservation types" },
    book: { ar: "احجز ترابيزة", en: "Reserve a table" },
  },
  general: {
    people: { ar: "الفريق", en: "The team" },
    services: { ar: "الخدمات", en: "Services" },
    book: { ar: "احجز موعد", en: "Book" },
  },
};

/** Every specialty the people here list, once each, in the order they first appear. */
export function specialties(staff: PublicStaffMember[]): string[] {
  const seen = new Map<string, string>();
  for (const m of staff) for (const s of m.specialties) if (!seen.has(s.toLocaleLowerCase())) seen.set(s.toLocaleLowerCase(), s);
  return [...seen.values()];
}

/** Who performs a service. Somebody linked to no services performs all of them, as booking reads it. */
export function staffFor(staff: PublicStaffMember[], serviceId: string): PublicStaffMember[] {
  return staff.filter((m) => m.serviceIds.length === 0 || m.serviceIds.includes(serviceId));
}

/** What a member performs, from the business's list. */
export function servicesOf<S extends { id: string }>(member: PublicStaffMember, services: S[]): S[] {
  return member.serviceIds.length === 0 ? services : services.filter((s) => member.serviceIds.includes(s.id));
}

/** Weekdays someone can be booked, 0 = Sunday, in the order they are given. */
export function workingDays(hours: DayHours[]): number[] {
  return hours.filter((h) => !h.isClosed).map((h) => h.dayOfWeek);
}

export interface Seating {
  /** Smallest and largest party one table takes; null when no table counts seats. */
  seats: { min: number; max: number } | null;
  /** Named areas — garden, terrace — once each. */
  areas: string[];
  count: number;
}

/** The tables a restaurant has set up, summarised. Null when it has none. */
export function seating(resources: PublicResource[], branchId: string | null = null): Seating | null {
  const tables = resources.filter((r) => r.kind === "TABLE" && (branchId === null || r.branchId === null || r.branchId === branchId));
  if (tables.length === 0) return null;
  const caps = tables.map((t) => t.capacity).filter((c): c is number => c !== null && c > 0);
  const areas = [...new Set(tables.map((t) => t.area?.trim()).filter((a): a is string => Boolean(a)))];
  return {
    seats: caps.length > 0 ? { min: Math.min(...caps), max: Math.max(...caps) } : null,
    areas,
    count: tables.length,
  };
}

/* ─── Leaving the app ─────────────────────────────────────── */

/** The public page — what Share sends. */
export function profileUrl(slug: string): string {
  return `${config.apiUrl}/company/${encodeURIComponent(slug)}`;
}

/**
 * Where booking happens until the app has its own flow: the website's
 * booking widget, opened on the choice already made here. `src=maw3ed`
 * credits the visit to the marketplace in the owner's analytics.
 */
export function bookingUrl(slug: string, choice: { serviceId?: string | null; staffId?: string | null } = {}): string {
  const q = ["src=maw3ed"];
  if (choice.serviceId) q.push(`service=${encodeURIComponent(choice.serviceId)}`);
  if (choice.serviceId && choice.staffId) q.push(`staff=${encodeURIComponent(choice.staffId)}`);
  return `${profileUrl(slug)}?${q.join("&")}#booking`;
}

/**
 * Directions by address. There are no coordinates in the data, so this
 * is a maps search for the written address and the area — which is what
 * a customer would type themselves — never a guessed pin.
 */
export function directionsUrl(parts: (string | null | undefined)[]): string | null {
  const query = parts.map((x) => x?.trim()).filter(Boolean).join(", ");
  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** wa.me wants international digits; a local 01… number is Egyptian. */
export function whatsappUrl(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 7) return null;
  let intl = d;
  if (raw.trim().startsWith("+")) intl = d;
  else if (d.startsWith("00")) intl = d.slice(2);
  else if (d.startsWith("0")) intl = "20" + d.slice(1);
  return `https://wa.me/${intl}`;
}

export function telUrl(raw: string): string | null {
  const d = raw.replace(/[^\d+]/g, "");
  return d.replace(/\D/g, "").length >= 3 ? `tel:${d}` : null;
}
