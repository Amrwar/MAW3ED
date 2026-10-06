import { z } from "zod";

// ─── Auth ──────────────────────────────────────────────────
export const signUpSchema = z.object({
  name:     z.string().min(2, "الاسم قصير جدًا"),
  email:    z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(8, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"),
});

export const loginSchema = z.object({
  email:    z.string().email("البريد الإلكتروني غير صحيح"),
  password: z.string().min(1, "أدخل كلمة المرور"),
});

// ─── Onboarding ───────────────────────────────────────────
const serviceItemSchema = z.object({
  nameAr:       z.string().min(2, "أدخل اسم الخدمة"),
  nameEn:       z.string().optional(),
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
  nameAr:     z.string().min(2, "أدخل اسم العمل بالعربية"),
  nameEn:     z.string().optional(),
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
export const businessUpdateSchema = z.object({
  nameAr:      z.string().min(2, "أدخل اسم العمل").optional(),
  nameEn:      z.string().optional(),
  taglineAr:   z.string().max(120).optional(),
  phone:       z.string().optional(),
  whatsapp:    z.string().optional(),
  address:     z.string().optional(),
  about:       z.string().max(600).optional(),
  cityId:      z.string().optional(),
  categoryId:  z.string().optional(),
  coverImage:  z.string().url("رابط صورة الغلاف غير صحيح").optional(),
  logoImage:   z.string().url("رابط الشعار غير صحيح").optional(),
});

// ─── Service ──────────────────────────────────────────────
export const serviceSchema = z.object({
  nameAr:       z.string().min(2, "أدخل اسم الخدمة"),
  nameEn:       z.string().optional(),
  descriptionAr: z.string().optional(),
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
  status: z.enum(["PENDING_PAYMENT", "PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW", "FAILED_PAYMENT"]),
});

// ─── Booking ──────────────────────────────────────────────
export const bookingSchema = z.object({
  serviceId:     z.string().min(1, "اختر خدمة"),
  date:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح"),
  startTime:     z.string().regex(/^\d{2}:\d{2}$/, "وقت غير صحيح"),
  customerName:  z.string().min(2, "أدخل اسمك الكامل"),
  customerPhone: z
    .string()
    .min(8, "أدخل رقم الهاتف")
    .refine((v) => /^[+\d][\d\s()\-+]{6,}$/.test(v), "رقم الهاتف غير صحيح"),
  customerEmail: z
    .string()
    .email("البريد الإلكتروني غير صحيح")
    .optional()
    .or(z.literal("")),
  notes:         z.string().max(500).optional(),
  // Restaurant
  tableId:       z.string().optional(),
  partySize:     z.number().int().min(1).max(50).optional(),
  // Barbershop
  staffMemberId: z.string().optional(),
  // Which location, when the business keeps more than one.
  branchId:      z.string().optional(),
  /**
   * Client-generated, stable across retries of the same submission. A
   * second request carrying the same key returns the first booking
   * instead of making another — which is what stops a double-tap, a
   * flaky connection or a browser retry producing two appointments.
   */
  idempotencyKey: z.string().min(8).max(100).optional(),
});

export type SignUpInput     = z.infer<typeof signUpSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type BusinessUpdate  = z.infer<typeof businessUpdateSchema>;
export type ServiceInput    = z.infer<typeof serviceSchema>;
export type BookingInput    = z.infer<typeof bookingSchema>;
