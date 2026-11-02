import { z } from "zod";
import { spanMinutes } from "@/lib/bookings/availability";

/**
 * Venue input rules and the pure answers built from them.
 *
 * Everything an operator can change is validated here once and used by
 * the routes; everything the public page says about access is derived
 * here from what the operator configured, so the page can never claim
 * more than the venue's own policy does.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const text = (max: number) => z.string().trim().max(max);
const optText = (max: number) => text(max).optional().nullable().transform((v) => (v ? v : null));

export const venueInfoSchema = z
  .object({
    nameAr: text(120).min(2),
    nameEn: optText(120),
    descriptionAr: optText(2000),
    descriptionEn: optText(2000),
    address: optText(300),
    phone: optText(30),
    website: z
      .string()
      .trim()
      .url()
      .max(300)
      .refine((u) => /^https?:\/\//i.test(u), { message: "الرابط لازم يبدأ بـ http أو https" })
      .optional()
      .nullable()
      .or(z.literal("").transform(() => null)),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    coverImage: z.string().url().max(500).nullable().optional(),
    logoImage: z.string().url().max(500).nullable().optional(),
  })
  .partial()
  .refine((v) => (v.latitude == null) === (v.longitude == null), { message: "الموقع لازم يكون خط عرض وخط طول مع بعض" });

export const venueHoursSchema = z
  .array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      openTime: z.string().regex(HHMM),
      closeTime: z.string().regex(HHMM),
      isClosed: z.boolean(),
    }),
  )
  .length(7)
  .refine((days) => new Set(days.map((d) => d.dayOfWeek)).size === 7, { message: "كل يوم مرة واحدة" });

export const zoneSchema = z.object({
  kind: z.enum(["FLOOR", "ZONE", "WING"]).default("FLOOR"),
  nameAr: text(80).min(1),
  nameEn: optText(80),
  level: z.number().int().min(-10).max(200).nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const gateSchema = z.object({
  nameAr: text(80).min(1),
  nameEn: optText(80),
  kind: z.enum(["VEHICLE", "PEDESTRIAN", "MIXED"]).default("MIXED"),
  code: optText(60),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const policySchema = z.object({
  visitorEligibility: z.enum(["OPEN", "BOOKING_REQUIRED", "OPERATOR_MANAGED", "CLOSED_TO_VISITORS"]),
  accessBeforeMinutes: z.number().int().min(0).max(720),
  accessAfterMinutes: z.number().int().min(0).max(720),
  maxGuestsPerBooking: z.number().int().min(0).max(50),
  reentryAllowed: z.boolean(),
  allowedGateIds: z.array(z.string().min(1)).max(50),
  accessInstructionsAr: optText(2000),
  accessInstructionsEn: optText(2000),
  // Phase 23 visitor passes. Optional, so a client that does not send
  // them leaves them as they are.
  identityRequirement: z.enum(["NAME", "NAME_AND_PHONE"]).optional(),
  lateEntryCutoffMinutes: z.number().int().min(0).max(720).nullable().optional(),
  noShowRevokeMinutes: z.number().int().min(0).max(720).nullable().optional(),
  escalationContact: z.string().trim().max(200).nullable().optional().transform((v) => (v === undefined ? undefined : v || null)),
});

/** A calendar date that exists: 2026-02-30 does not. */
const realDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => {
    const t = new Date(`${d}T00:00:00Z`);
    return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
  }, { message: "تاريخ غير صحيح" });

export const exceptionSchema = z
  .object({
    kind: z.enum(["CLOSED", "ACCESS_SUSPENDED", "SPECIAL_HOURS", "BOOKINGS_PAUSED"]),
    startsOn: realDate,
    endsOn: realDate,
    openTime: z.string().regex(HHMM).nullable().optional(),
    closeTime: z.string().regex(HHMM).nullable().optional(),
    noteAr: optText(500),
    noteEn: optText(500),
  })
  .refine((v) => v.endsOn >= v.startsOn, { message: "تاريخ النهاية قبل البداية" })
  .refine((v) => v.kind !== "SPECIAL_HOURS" || (!!v.openTime && !!v.closeTime), {
    message: "المواعيد الخاصة محتاجة وقت فتح وقفل",
  });

/* ─── Visitor access (for the future access service) ────────── */

export interface AccessPolicy {
  visitorEligibility: "OPEN" | "BOOKING_REQUIRED" | "OPERATOR_MANAGED" | "CLOSED_TO_VISITORS";
  accessBeforeMinutes: number;
  accessAfterMinutes: number;
  maxGuestsPerBooking: number;
  reentryAllowed: boolean;
}

/**
 * The window a booking would let its holder in for, as instants.
 *
 * This is a calculation, not an authorisation: no gate is opened by
 * Maw3ed. A separate visitor-access service, once an operator provides
 * an integration, can ask this for the window and then decide for
 * itself. Null when the policy gives bookings no access of their own.
 */
export function accessWindow(
  booking: { startsAt: Date; endsAt: Date; status: string; partySize?: number | null },
  policy: AccessPolicy,
): { from: Date; until: Date; people: number; reentry: boolean } | null {
  if (policy.visitorEligibility !== "BOOKING_REQUIRED") return null;
  if (!["CONFIRMED", "ARRIVED", "IN_PROGRESS"].includes(booking.status)) return null;
  const guests = Math.min(Math.max((booking.partySize ?? 1) - 1, 0), policy.maxGuestsPerBooking);
  return {
    from: new Date(booking.startsAt.getTime() - policy.accessBeforeMinutes * 60_000),
    until: new Date(booking.endsAt.getTime() + policy.accessAfterMinutes * 60_000),
    people: 1 + guests,
    reentry: policy.reentryAllowed,
  };
}

/* ─── What the public page says ─────────────────────────────── */

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Questions and answers built only from the venue's configured policy.
 * Nothing here promises a gate pass, an integration or an
 * endorsement: when the operator manages entry, the answer says so and
 * points to the operator's own instructions.
 */
export function venueFaq(
  v: { nameAr: string; nameEn: string | null },
  policy: AccessPolicy | null,
  lang: "ar" | "en",
): FaqItem[] {
  const en = lang === "en";
  const name = en ? v.nameEn || v.nameAr : v.nameAr;
  const items: FaqItem[] = [
    {
      q: en ? `How do I book at a business in ${name}?` : `إزاي أحجز في مكان جوه ${name}؟`,
      a: en
        ? "Choose a business from the directory and book on its page. The booking goes to the business directly."
        : "اختار المكان من الدليل واحجز من صفحته. الحجز بيروح للمكان نفسه مباشرة.",
    },
  ];
  if (!policy) return items;

  const entry: Record<AccessPolicy["visitorEligibility"], [string, string]> = {
    OPEN: [
      "يقدر أي حد يدخل في مواعيد الفتح.",
      "Visitors can enter during opening hours.",
    ],
    BOOKING_REQUIRED: [
      "الدخول للزوار بحجز في مكان جوه. الحجز لوحده مش تصريح دخول — اتبع تعليمات الدخول اللي تحت.",
      "Visitors enter with a booking at a business inside. A booking on its own is not an entry pass — follow the access instructions below.",
    ],
    OPERATOR_MANAGED: [
      "الدخول بتنظمه إدارة المكان. اتبع تعليمات الدخول اللي تحت.",
      "Entry is arranged by the venue's management. Follow the access instructions below.",
    ],
    CLOSED_TO_VISITORS: [
      "المكان مش مفتوح للزوار حاليًا.",
      "The venue is not open to visitors at the moment.",
    ],
  };
  items.push({
    q: en ? "Can I enter as a visitor?" : "أقدر أدخل كزائر؟",
    a: en ? entry[policy.visitorEligibility][1] : entry[policy.visitorEligibility][0],
  });

  if (policy.visitorEligibility === "BOOKING_REQUIRED") {
    items.push({
      q: en ? "When can I arrive?" : "أوصل امتى؟",
      a: en
        ? `Up to ${policy.accessBeforeMinutes} minutes before your appointment, and you may stay up to ${policy.accessAfterMinutes} minutes after it ends.`
        : `لحد ${policy.accessBeforeMinutes} دقيقة قبل ميعادك، وتقدر تفضل لحد ${policy.accessAfterMinutes} دقيقة بعد ما يخلص.`,
    });
    items.push({
      q: en ? "Can I bring guests?" : "أقدر أجيب حد معايا؟",
      a:
        policy.maxGuestsPerBooking === 0
          ? en ? "No — entry is for the person who booked." : "لأ — الدخول للي حاجز بس."
          : en
            ? `Up to ${policy.maxGuestsPerBooking} guest(s) per booking.`
            : `لحد ${policy.maxGuestsPerBooking} مع كل حجز.`,
    });
    items.push({
      q: en ? "Can I leave and come back?" : "أقدر أخرج وأرجع؟",
      a: policy.reentryAllowed
        ? en ? "Yes, within your access window." : "أيوه، في وقت الدخول المسموح."
        : en ? "No — re-entry is not allowed on the same booking." : "لأ — مفيش دخول تاني بنفس الحجز.",
    });
  }
  return items;
}

/**
 * Today's hours once the venue's dated exceptions are applied: a
 * CLOSED day is closed, SPECIAL_HOURS replace the usual ones.
 */
export function hoursWithExceptions<H extends { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>(
  hours: H[],
  exceptions: { kind: string; startsOn: string; endsOn: string; openTime: string | null; closeTime: string | null }[],
  today: string,
  dayOfWeek: number,
): { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[] {
  const hit = exceptions.find((e) => e.startsOn <= today && e.endsOn >= today && (e.kind === "CLOSED" || e.kind === "SPECIAL_HOURS"));
  if (!hit) return hours;
  const rest = hours.filter((h) => h.dayOfWeek !== dayOfWeek);
  return hit.kind === "CLOSED"
    ? [...rest, { dayOfWeek, openTime: "00:00", closeTime: "00:00", isClosed: true }]
    : [...rest, { dayOfWeek, openTime: hit.openTime ?? "00:00", closeTime: hit.closeTime ?? "00:00", isClosed: !hit.openTime || !hit.closeTime }];
}

/** Open right now, for a day's hours in Cairo minutes; handles overnight. */
export function isOpenAt(
  hours: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[],
  dayOfWeek: number,
  minutes: number,
): boolean {
  const today = hours.find((h) => h.dayOfWeek === dayOfWeek);
  if (today && !today.isClosed) {
    const { start, end } = spanMinutes(today.openTime, today.closeTime);
    if (minutes >= start && minutes < end) return true;
  }
  // Yesterday's overnight hours still running after midnight.
  const y = hours.find((h) => h.dayOfWeek === (dayOfWeek + 6) % 7);
  if (y && !y.isClosed) {
    const { start, end } = spanMinutes(y.openTime, y.closeTime);
    if (end > 24 * 60 && minutes + 24 * 60 < end && minutes + 24 * 60 >= start) return true;
  }
  return false;
}

/* ─── The location hierarchy ────────────────────────────────── */

export interface PlaceNode {
  level: "country" | "city" | "district" | "compound" | "venue" | "zone" | "branch";
  nameAr: string;
  nameEn: string | null;
  slug?: string | null;
}

const COUNTRIES: Record<string, [string, string]> = { EG: ["مصر", "Egypt"] };

/**
 * Country → city → district → compound → venue → zone → branch, with
 * whatever levels a place actually has. A business outside any venue
 * simply has no compound, venue or zone level.
 */
export function locationPath(p: {
  countryCode: string;
  city: { nameAr: string; nameEn: string; slug: string };
  district?: { nameAr: string; nameEn: string; slug: string } | null;
  compound?: { nameAr: string; nameEn: string | null; slug: string } | null;
  venue?: { nameAr: string; nameEn: string | null; slug: string } | null;
  zone?: { nameAr: string; nameEn: string | null } | null;
  branch?: { nameAr: string; nameEn: string | null } | null;
}): PlaceNode[] {
  const [ar, en] = COUNTRIES[p.countryCode] ?? [p.countryCode, p.countryCode];
  const out: PlaceNode[] = [
    { level: "country", nameAr: ar, nameEn: en },
    { level: "city", ...p.city },
  ];
  if (p.district) out.push({ level: "district", ...p.district });
  if (p.compound) out.push({ level: "compound", ...p.compound });
  if (p.venue) out.push({ level: "venue", ...p.venue });
  if (p.zone) out.push({ level: "zone", ...p.zone });
  if (p.branch) out.push({ level: "branch", ...p.branch });
  return out;
}

/** A Google Maps directions link, from a pin, or from a name when there is none. */
export function directionsUrl(p: { latitude: number | null; longitude: number | null; label: string }): string {
  const dest = p.latitude != null && p.longitude != null ? `${p.latitude},${p.longitude}` : p.label;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
