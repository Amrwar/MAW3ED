import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { normalisePhone } from "@/lib/phone";
import { callerKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { joinWaitlist } from "@/lib/bookings/slot-waitlist";

/**
 * POST /api/public/:slug/waitlist — wait for a time on a full day
 * (lib/bookings/slot-waitlist). An email or a signed-in account is how
 * the offer reaches them; the answer carries the link to see or leave
 * the waitlist. Throttled per address like booking.
 */
const body = z.object({
  serviceId: z.string().min(1).max(40),
  staffMemberId: z.string().max(40).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/),
  toTime: z.string().regex(/^\d{2}:\d{2}$/),
  partySize: z.number().int().min(1).max(50).optional(),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().min(5).max(40).refine((v) => normalisePhone(v) !== null, "رقم الموبايل غير صحيح"),
  customerEmail: z.string().email("البريد الإلكتروني غير صحيح").optional().or(z.literal("")),
});

const WHY: Record<string, [string, number]> = {
  disabled: ["المكان ده مش مفعّل قائمة الانتظار", 409],
  "bad-window": ["اختار وقت بداية قبل وقت النهاية", 422],
  "bad-date": ["التاريخ ده مش متاح للحجز", 422],
  "service-not-found": ["الخدمة غير موجودة", 404],
  "already-waiting": ["إنت في قائمة الانتظار لليوم ده بالفعل", 409],
  full: ["قائمة الانتظار لليوم ده كاملة", 409],
  "bad-phone": ["رقم الموبايل غير صحيح", 422],
};

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const limited = await rateLimit("publicBooking", `${await callerKey()}|wait|${slug.toLowerCase()}`);
    if (!limited.ok) return tooManyRequests(limited);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid", field: String(parsed.error.issues[0].path[0] ?? "") });
    const business = await db.business.findFirst({ where: { slug, isPublished: true }, select: { id: true } });
    if (!business) return err("لم يتم العثور على هذا العمل", 404, { code: "business-not-found" });
    const r = await joinWaitlist({ businessId: business.id, ...parsed.data, customerEmail: parsed.data.customerEmail || null });
    if (!r.ok) {
      const [message, status] = WHY[r.why];
      return err(message, status, { code: r.why });
    }
    return ok({ manageUrl: `/booking-waitlist/${r.manageToken}` }, 201);
  } catch (e) {
    log.error("[waitlist join]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
