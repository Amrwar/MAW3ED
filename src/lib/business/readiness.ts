import { spanMinutes } from "@/lib/bookings/availability";

/**
 * Is this business ready to take bookings from the public?
 *
 * One checklist, computed on the server from the business's own rows,
 * read by the setup page, the dashboard's progress card, the publish
 * endpoint and the email-verification link. A listing goes live only
 * when every REQUIRED item passes; RECOMMENDED items raise the score
 * and are shown, but never block. What is required depends on the kind
 * of business: a restaurant is not asked for staff, a barbershop is not
 * asked for tables.
 *
 * Pure: the facts are loaded by loadReadiness (readiness-load.ts), so
 * every rule can be tested without a database.
 */

export type ReadinessLevel = "required" | "recommended";

export type ReadinessKey =
  | "category"
  | "phone"
  | "email"
  | "whatsapp"
  | "address"
  | "location"
  | "hours"
  | "services"
  | "prices"
  | "team"
  | "tables"
  | "policies"
  | "notifications"
  | "branding"
  | "testBooking";

export interface ReadinessItem {
  key: ReadinessKey;
  level: ReadinessLevel;
  done: boolean;
  /** Where in the dashboard it is fixed. */
  href: string;
  ar: string;
  en: string;
  /** Why it is not done, when there is something more specific to say. */
  whyAr?: string;
  whyEn?: string;
}

export interface ReadinessFacts {
  businessType: "GENERAL" | "BARBERSHOP" | "RESTAURANT";
  hasCategory: boolean;
  phone: string | null;
  address: string | null;
  hasLocation: boolean;
  logoImage: string | null;
  about: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** Services the public can book (isAvailable). */
  services: { duration: number; price: number }[];
  hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
  activeStaff: number;
  activeResources: number;
  depositEnabled: boolean;
  /** Whether the effective plan includes taking deposits. */
  depositsAllowed: boolean;
  policiesReviewed: boolean;
  /** The owner can be told about a booking: a verified email, or a notification phone. */
  notificationReachable: boolean;
  isPublished: boolean;
  testBookings: number;
}

export interface Readiness {
  items: ReadinessItem[];
  /** Every required item passes. */
  canPublish: boolean;
  /** Required items still missing, in checklist order. */
  missing: ReadinessKey[];
  /** 0..100 over required and recommended together. */
  percent: number;
  requiredDone: number;
  requiredTotal: number;
}

const MIN_DURATION = 5;
const MAX_DURATION = 12 * 60;

/** A phone with at least eight digits, however it was written. */
function looksLikePhone(value: string | null): boolean {
  return !!value && value.replace(/\D/g, "").length >= 8;
}

/** The longest open stretch in the week, in minutes (overnight hours counted). */
export function longestOpenWindow(hours: ReadinessFacts["hours"]): number {
  let best = 0;
  for (const h of hours) {
    if (h.isClosed) continue;
    const { start, end } = spanMinutes(h.openTime, h.closeTime);
    best = Math.max(best, end - start);
  }
  return best;
}

export function computeReadiness(f: ReadinessFacts): Readiness {
  const validServices = f.services.filter((s) => s.duration >= MIN_DURATION && s.duration <= MAX_DURATION);
  const window = longestOpenWindow(f.hours);
  const shortest = validServices.length ? Math.min(...validServices.map((s) => s.duration)) : Infinity;
  const pricesValid = f.services.every((s) => Number.isFinite(s.price) && s.price >= 0);
  const depositsCoherent = !f.depositEnabled || (f.depositsAllowed && f.services.some((s) => s.price > 0));

  const items: ReadinessItem[] = [
    {
      key: "category", level: "required", done: f.hasCategory, href: "/dashboard/public-profile",
      ar: "التخصص محدد", en: "Category chosen",
    },
    {
      key: "phone", level: "required", done: looksLikePhone(f.phone), href: "/dashboard/public-profile",
      ar: "رقم تليفون للتواصل", en: "Contact phone number",
    },
    {
      key: "email", level: "required", done: f.emailVerified, href: "/dashboard/setup#email",
      ar: "تأكيد البريد الإلكتروني", en: "Email confirmed",
      whyAr: "افتح رابط التأكيد اللي وصلك على الإيميل", whyEn: "Open the confirmation link we emailed you",
    },
    {
      key: "whatsapp", level: "recommended", done: f.phoneVerified, href: "/dashboard/settings",
      ar: "تأكيد رقم واتساب", en: "WhatsApp number confirmed",
    },
    {
      key: "address", level: "required", done: !!f.address?.trim(), href: "/dashboard/public-profile",
      ar: "العنوان", en: "Address",
    },
    {
      key: "location", level: "recommended", done: f.hasLocation, href: "/dashboard/public-profile",
      ar: "مكانك على الخريطة", en: "Pin on the map",
    },
    {
      key: "hours", level: "required", done: window > 0 && window >= shortest, href: "/dashboard/settings?tab=hours",
      ar: "مواعيد العمل", en: "Opening hours",
      ...(window === 0
        ? { whyAr: "كل الأيام مقفولة", whyEn: "Every day is closed" }
        : window < shortest
          ? { whyAr: "ولا يوم مفتوح وقت كفاية لأقصر خدمة", whyEn: "No day is open long enough for your shortest service" }
          : {}),
    },
    {
      key: "services", level: "required", done: validServices.length > 0, href: "/dashboard/services",
      ar: "خدمة واحدة على الأقل متاحة للحجز", en: "At least one bookable service",
      ...(f.services.length > 0 && validServices.length === 0
        ? { whyAr: `مدة الخدمة لازم تكون بين ${MIN_DURATION} دقايق و12 ساعة`, whyEn: `A service must last between ${MIN_DURATION} minutes and 12 hours` }
        : {}),
    },
    {
      key: "prices", level: "required", done: pricesValid && depositsCoherent, href: "/dashboard/services",
      ar: "الأسعار والعربون مظبوطين", en: "Prices and deposit make sense",
      ...(!pricesValid
        ? { whyAr: "في سعر سالب", whyEn: "A price is negative" }
        : !depositsCoherent
          ? f.depositsAllowed
            ? { whyAr: "العربون شغال بس كل الخدمات مجانية", whyEn: "Deposits are on but every service is free" }
            : { whyAr: "العربون شغال بس باقتك مش بتسمح بيه", whyEn: "Deposits are on but your plan does not include them" }
          : {}),
    },
  ];

  // What a business of this kind needs to run its diary, and nothing more.
  if (f.businessType === "BARBERSHOP") {
    items.push({
      key: "team", level: "recommended", done: f.activeStaff > 0, href: "/dashboard/staff",
      ar: "فريق العمل", en: "Your team",
    });
  }
  if (f.businessType === "RESTAURANT") {
    items.push({
      key: "tables", level: "recommended", done: f.activeResources > 0, href: "/dashboard/resources",
      ar: "الترابيزات وعدد الكراسي", en: "Tables and seats",
    });
  }

  items.push(
    {
      key: "policies", level: "required", done: f.policiesReviewed, href: "/dashboard/setup#policies",
      ar: "سياسة التأكيد والإلغاء", en: "Confirmation and cancellation policy",
    },
    {
      key: "notifications", level: "recommended", done: f.notificationReachable, href: "/dashboard/settings?tab=notifications",
      ar: "نوصلك إزاي لما يجيلك حجز", en: "How you hear about new bookings",
    },
    {
      key: "branding", level: "recommended", done: !!f.logoImage && !!f.about?.trim(), href: "/dashboard/public-profile",
      ar: "اللوجو ونبذة عنك", en: "Logo and a short description",
    },
    {
      key: "testBooking", level: "recommended", done: f.isPublished || f.testBookings > 0, href: "/dashboard/setup#test",
      ar: "جرّب تحجز بنفسك", en: "Try a test booking",
    },
  );

  const required = items.filter((i) => i.level === "required");
  const requiredDone = required.filter((i) => i.done).length;
  const done = items.filter((i) => i.done).length;
  return {
    items,
    canPublish: requiredDone === required.length,
    missing: required.filter((i) => !i.done).map((i) => i.key),
    percent: Math.round((done / items.length) * 100),
    requiredDone,
    requiredTotal: required.length,
  };
}
