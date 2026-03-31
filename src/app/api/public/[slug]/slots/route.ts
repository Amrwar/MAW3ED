import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";

type Params = { params: Promise<{ slug: string }> };

/**
 * GET /api/public/[slug]/slots?serviceId=&date=YYYY-MM-DD
 *
 * Returns available time slots for a given business, service, and date.
 * Slots that are already booked (PENDING or CONFIRMED) are excluded.
 * No auth required — public endpoint.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");
    const date      = searchParams.get("date");

    if (!serviceId || !date) return err("serviceId و date مطلوبان", 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err("تاريخ غير صحيح", 400);

    // Parse as UTC midnight so it matches how bookings are stored
    const [year, month, day] = date.split("-").map(Number);
    const dateUTC = new Date(Date.UTC(year, month - 1, day));
    if (isNaN(dateUTC.getTime())) return err("تاريخ غير صحيح", 400);

    // Reject past dates
    const todayUTC = new Date(Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ));
    if (dateUTC < todayUTC) return ok({ slots: [] });

    const business = await db.business.findUnique({
      where: { slug, isPublished: true },
    });
    if (!business) return err("لم يتم العثور على هذا العمل", 404);

    const service = await db.service.findFirst({
      where: { id: serviceId, businessId: business.id, isAvailable: true },
    });
    if (!service) return err("الخدمة غير موجودة", 404);

    // Get the availability rule for this day of week
    const dayOfWeek = dateUTC.getUTCDay(); // 0=Sunday
    const rule = await db.availabilityRule.findUnique({
      where: { businessId_dayOfWeek: { businessId: business.id, dayOfWeek } },
    });

    if (!rule || rule.isClosed) return ok({ slots: [] });

    // Generate all candidate slots within open hours
    const allSlots = generateSlots(rule.openTime, rule.closeTime, service.duration);

    // Fetch already-booked start times for this date
    const booked = await db.booking.findMany({
      where: {
        businessId: business.id,
        date:       dateUTC,
        status:     { in: ["PENDING", "CONFIRMED"] },
      },
      select: { startTime: true },
    });
    const bookedSet = new Set(booked.map((b) => b.startTime));

    // Filter booked slots out; also filter past times when date is today
    const isToday = dateUTC.getTime() === todayUTC.getTime();
    const nowMinutes = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();

    const available = allSlots.filter((slot) => {
      if (bookedSet.has(slot)) return false;
      if (isToday) {
        const [h, m] = slot.split(":").map(Number);
        // Add 120-min buffer for Egypt UTC+2 offset so we don't show slots that
        // have already passed in local time
        if (h * 60 + m <= nowMinutes + 120) return false;
      }
      return true;
    });

    return ok({ slots: available });
  } catch (e) {
    console.error("[slots GET]", e);
    return err("حدث خطأ", 500);
  }
}

// ─── Helpers ──────────────────────────────────────────────

/** Generate time slot strings from openTime to closeTime with step = duration (minutes) */
function generateSlots(openTime: string, closeTime: string, duration: number): string[] {
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  const open  = oh * 60 + om;
  const close = ch * 60 + cm;
  const slots: string[] = [];
  for (let t = open; t + duration <= close; t += duration) {
    const hh = Math.floor(t / 60).toString().padStart(2, "0");
    const mm = (t % 60).toString().padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}
