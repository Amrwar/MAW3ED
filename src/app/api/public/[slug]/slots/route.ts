import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { timeToMinutes, overlaps } from "@/lib/bookings/overlap";

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

    // Reject past dates — compare in Egypt local time to avoid UTC-day mismatch
    const nowEgyptStr = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" }); // YYYY-MM-DD
    const [ty, tm, td] = nowEgyptStr.split("-").map(Number);
    const todayUTC = new Date(Date.UTC(ty, tm - 1, td));
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

    // Fetch already-booked ranges for this date (PENDING + CONFIRMED)
    const booked = await db.booking.findMany({
      where: {
        businessId: business.id,
        date:       dateUTC,
        status:     { in: ["PENDING", "CONFIRMED"] },
      },
      select: {
        startTime: true,
        endTime:   true,
        service:   { select: { duration: true } },
      },
    });

    // Convert each booking to a [startMin, endMin) range (legacy fallback for missing endTime)
    const bookedRanges = booked.map((b) => {
      const startMin = timeToMinutes(b.startTime);
      const endMin   = b.endTime
        ? timeToMinutes(b.endTime)
        : startMin + b.service.duration;
      return { startMin, endMin };
    });

    // Filter out slots that overlap any booked range; also filter past times for today
    const isToday       = dateUTC.getTime() === todayUTC.getTime();
    const nowEgypt      = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
    const nowMinutes    = nowEgypt.getHours() * 60 + nowEgypt.getMinutes();
    const BUFFER_MINS   = 30;
    const serviceDuration = service.duration;

    const available = allSlots.filter((slot) => {
      const slotStart = timeToMinutes(slot);
      const slotEnd   = slotStart + serviceDuration;

      if (bookedRanges.some(({ startMin, endMin }) => overlaps(slotStart, slotEnd, startMin, endMin))) {
        return false;
      }

      if (isToday && slotStart < nowMinutes + BUFFER_MINS) return false;

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
