import { z } from "zod";
import { installArabicZodErrors } from "./zod-arabic";
import { dialable, normalisePhone, PHONE_INVALID } from "./phone";

// Installed here because every route that validates anything imports
// this module, so the map is in place before the first parse. Zod's own
// fallback messages are English, and routes hand issues[0].message
// straight to the client.
installArabicZodErrors();

// Every name a person types is bounded. Names are echoed into emails,
// WhatsApp messages, notifications and dashboards; an unbounded one is
// a free 1 MB payload carried into every one of those, and no real
// name — Arabic four-part names included — comes near a hundred.
const NAME_MAX = 100;
const NAME_TOO_LONG = "الاسم طويل جدًا";

// ─── Auth ──────────────────────────────────────────────────
export const signUpSchema = z.object({
  name:     z.string().trim().min(2, "الاسم قصير جدًا").max(NAME_MAX, NAME_TOO_LONG),
  // Stored lower-case, so every later lookup agrees with it.
  email:    z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const loginSchema = z.object({
  email:    z.string().trim().toLowerCase().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});

// ─── Onboarding ───────────────────────────────────────────
const serviceItemSchema = z.object({
  nameAr:       z.string().trim().min(2, "أدخل اسم الخدمة").max(NAME_MAX, NAME_TOO_LONG),
  nameEn:       z.string().trim().max(NAME_MAX, NAME_TOO_LONG).optional(),
  descriptionAr: z.string().optional(),
  duration:     z.number().min(5).max(480),
  price:        z.number().min(0),
});

const availabilityDaySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  openTime:  z.string().regex(/^\d{2}:\d{2}$/, "صيغة الوقت غير صحيحة"),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/, "صيغة الوقت غير صحيحة"),
  isClosed:  z.boolean(),
});

export const onboardingSchema = z.object({
  nameAr:     z.string().trim().min(2, "أدخل اسم العمل بالعربية").max(NAME_MAX, NAME_TOO_LONG),
  nameEn:     z.string().trim().max(NAME_MAX, NAME_TOO_LONG).optional(),
  categoryId: z.string().min(1, "اختر التخصص"),
  cityId:     z.string().min(1, "اختر المدينة"),
  phone:      z.string().min(8, "أدخل رقم الهاتف"),
  whatsapp:   z.string().optional(),
  address:    z.string().optional(),
  taglineAr:  z.string().max(120).optional(),
  about:      z.string().max(600).optional(),
  coverImage: z.string().url().optional(),
  logoImage:  z.string().url().optional(),
  services:   z.array(serviceItemSchema).min(1, "أضف خدمة واحدة على الأقل"),
  availability: z.array(availabilityDaySchema).length(7),
  /// An organization's email invitation (signup?org_invite=...): the new
  /// business joins that organization's directory on creation.
  orgInvite:  z.string().trim().max(100).optional(),
  slug:       z
    .string()
    .min(3, "الرابط قصير جدًا")
    .max(50, "الرابط طويل جدًا")
    .regex(/^[a-z0-9-]+$/, "يجب أن يحتوي الرابط على أحرف إنجليزية صغيرة وأرقام وشرطات فقط")
    .refine((s) => !s.startsWith("-") && !s.endsWith("-"), {
      message: "الرابط لا يجب أن يبدأ أو ينتهي بشرطة",
    }),
});

// ─── Business update ──────────────────────────────────────
/**
 * A field the owner is allowed to empty.
 *
 * Three states have to stay distinguishable, and the bug this fixes
 * came from collapsing two of them:
 *
 *   - the key is absent        → leave whatever is stored alone
 *   - the key is null or ""    → clear it
 *   - the key has a value      → set it
 *
 * `undefined` survives as `undefined`, which Prisma reads as "do not
 * touch this column"; only an explicit empty becomes null. Transforming
 * `undefined` to null here would wipe every field a client did not
 * happen to send.
 */
const clearable = <T extends z.ZodTypeAny>(inner: T) =>
  inner
    .or(z.literal(""))
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v));

// ─── Location ─────────────────────────────────────────────
//
// A pin the owner set — both coordinates or neither. The dashboard reads
// them out of a pasted Google Maps link (lib/geo.ts); nothing is ever
// geocoded or guessed.
export const latitude = z.number().min(-90).max(90).nullable().optional();
export const longitude = z.number().min(-180).max(180).nullable().optional();

export function bothOrNeither(v: { latitude?: number | null; longitude?: number | null }, ctx: z.RefinementCtx) {
  const lat = v.latitude;
  const lng = v.longitude;
  if (lat === undefined && lng === undefined) return;
  if ((lat === null) !== (lng === null) || (lat === undefined) !== (lng === undefined)) {
    ctx.addIssue({ code: "custom", message: "الموقع محتاج خط العرض وخط الطول مع بعض", path: ["latitude"] });
    return;
  }
  if (lat === 0 && lng === 0) {
    ctx.addIssue({ code: "custom", message: "الموقع ده مش صحيح", path: ["latitude"] });
  }
}

export const businessUpdateSchema = z.object({
  // Required: a business must keep a name, a city and a category.
  nameAr:      z.string().trim().min(2, "أدخل اسم العمل").max(NAME_MAX, NAME_TOO_LONG).optional(),
  cityId:      z.string().min(1).optional(),
  categoryId:  z.string().min(1).optional(),

  // Clearable: emptying any of these is a thing an owner may want.
  nameEn:      clearable(z.string().trim().max(NAME_MAX, NAME_TOO_LONG)),
  taglineAr:   clearable(z.string().max(120)),
  phone:       clearable(z.string()),
  whatsapp:    clearable(z.string()),
  address:     clearable(z.string()),
  about:       clearable(z.string().max(600)),
  coverImage:  clearable(z.string().url("رابط صورة الغلاف غير صحيح")),
  logoImage:   clearable(z.string().url("رابط الشعار غير صحيح")),
  latitude,
  longitude,
}).superRefine(bothOrNeither);

// ─── Service ──────────────────────────────────────────────
export const serviceSchema = z.object({
  nameAr:       z.string().trim().min(2, "أدخل اسم الخدمة").max(NAME_MAX, NAME_TOO_LONG),
  // Clearable for the same reason the business fields are: an owner who
  // empties a description and saves expects it to go.
  nameEn:       clearable(z.string().trim().max(NAME_MAX, NAME_TOO_LONG)),
  descriptionAr: clearable(z.string()),
  duration:     z.number().min(5).max(480),
  price:        z.number().min(0),
  isAvailable:  z.boolean().optional(),
  sortOrder:    z.number().optional(),
});

// ─── Availability ─────────────────────────────────────────
export const availabilitySchema = z.object({
  availability: z.array(availabilityDaySchema).length(7),
});

// ─── Booking status update ────────────────────────────────
export const bookingStatusSchema = z.object({
  // ARRIVED and IN_PROGRESS were missing here while existing
  // everywhere else: in BookingStatus, in the labels both languages
  // show, and in booking_no_overlap, which counts them as holding a
  // slot. The result was two states the database models, the UI names
  // and no API could ever set.
  status: z.enum([
    "PENDING_PAYMENT",
    "PENDING",
    "CONFIRMED",
    "ARRIVED",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
    "FAILED_PAYMENT",
  ]),
});

// ─── Booking ──────────────────────────────────────────────
export const bookingSchema = z.object({
  serviceId:     z.string().min(1, "اختر خدمة"),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح"),
  startTime:     z.string().regex(/^\d{2}:\d{2}$/, "وقت غير صحيح"),
  customerName:  z.string().trim().min(2, "أدخل اسمك الكامل").max(NAME_MAX, NAME_TOO_LONG),
  // A number normalisePhone() can read, the same rule as signing in: it
  // is how the booking finds the customer's account (the
  // customerPhoneE164 column) and where its confirmation goes. Any eight
  // characters used to pass, so a booking could reach nobody.
  customerPhone: z
    .string()
    .min(1, "أدخل رقم الهاتف")
    .refine((v) => normalisePhone(v) !== null, PHONE_INVALID),
  customerEmail: z
    .string()
    .email("البريد الإلكتروني غير صحيح")
    .optional()
    .or(z.literal("")),
  notes:         z.string().max(500).optional(),
  /** Deprecated alias for resourceId, still sent by older clients. */
  tableId:       z.string().optional(),
  /** The room, chair, table or machine the appointment holds. */
  resourceId:    z.string().optional(),
  partySize:     z.number().int().min(1).max(50).optional(),
  // Barbershop
  staffMemberId: z.string().optional(),
  // Which location, when the business keeps more than one.
  branchId:      z.string().optional(),
  // From POST /api/public/phone-proof, when guest bookings must prove
  // their number (BOOKING_PHONE_VERIFICATION).
  phoneProof:    z.string().max(2000).optional(),
  /// The published organization directory the customer came from
  /// (?org= on the business page). Attribution only; checked
  /// server-side against an APPROVED association before it counts.
  org:           z.string().trim().toLowerCase().max(60).optional(),
  /**
   * Client-generated, stable across retries of the same submission. A
   * second request carrying the same key returns the first booking
   * instead of making another — which is what stops a double-tap, a
   * flaky connection or a browser retry producing two appointments.
   */
  idempotencyKey: z.string().min(8).max(100).optional(),
  /// The channel the visitor arrived through. Optional, because a
  /// booking that arrives without one is unattributed, which is a real
  /// answer — never guessed into a channel it might not be.
  source: z
    .enum([
      "DIRECT", "INSTAGRAM", "WHATSAPP", "FACEBOOK",
      "GOOGLE", "WEBSITE", "QR", "MAW3ED", "OTHER",
    ])
    .optional(),
  /// A coupon the customer typed. Looked up server-side; the price is
  /// never taken from the request.
  discountCode: z.string().trim().max(40).optional(),
});

/**
 * A booking the owner enters by hand. The customer is standing at the
 * counter or on the phone, and the number they give may be a landline —
 * still a number to call, so dialable() rather than normalisePhone().
 * Such a booking simply links to no customer account.
 */
export const ownerBookingSchema = bookingSchema.extend({
  customerPhone: z
    .string()
    .min(1, "أدخل رقم الهاتف")
    .refine((v) => dialable(v) !== null, "رقم الهاتف غير صحيح"),
});

export type SignUpInput     = z.infer<typeof signUpSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type BusinessUpdate  = z.infer<typeof businessUpdateSchema>;
export type ServiceInput    = z.infer<typeof serviceSchema>;
export type BookingInput    = z.infer<typeof bookingSchema>;
