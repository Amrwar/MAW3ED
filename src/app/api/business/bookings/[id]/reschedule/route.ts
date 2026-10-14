import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { bookingScope, requireBusinessAccess } from "@/lib/business-access";
import { loadAvailability } from "@/lib/bookings/schedule";
import { bookingInstants, dateToUTC } from "@/lib/bookings/instants";
import { minutesToTime, timeToMinutes } from "@/lib/bookings/time";
import { notify } from "@/lib/notifications";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  date: z.string().regex(DATE, "تاريخ غير صحيح"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "وقت غير صحيح"),
});

/** The booking as the business may move it: theirs, and still ahead. */
async function movable(id: string) {
  const { business, actor } = await requireBusinessAccess("bookings.reschedule");
  const booking = await db.booking.findFirst({
    where: { id, ...bookingScope(business, actor) },
    include: { service: { select: { duration: true } } },
  });
  return booking;
}

/**
 * GET /api/business/bookings/[id]/reschedule?date=YYYY-MM-DD
 *
 * The free times this booking could move to on that day: the same
 * engine as every other slot list (hours, staff, breaks, blocks, other
 * bookings), with this booking left out so it can move within its day.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const date = new URL(req.url).searchParams.get("date") ?? "";
    if (!DATE.test(date)) return err("تاريخ غير صحيح", 422, { code: "invalid" });

    const booking = await movable(id);
    if (!booking) return err("الحجز غير موجود", 404, { code: "not-found" });

    const availability = await loadAvailability({
      businessId: booking.businessId,
      serviceId: booking.serviceId,
      date,
      staffMemberId: booking.staffMemberId,
      resourceId: booking.resourceId,
      branchId: booking.branchId,
      excludeBookingId: booking.id,
    });
    return ok({ date, slots: availability.slots, reason: availability.reason ?? null });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business reschedule slots]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/**
 * POST /api/business/bookings/[id]/reschedule
 *
 * The business moves an appointment — for an owner or a manager. The
 * same checks as the customer's own reschedule, from the same engine,
 * and the database's overlap constraint behind them for the race. It
 * keeps its status: the business chose the new time, so a confirmed
 * booking stays confirmed. The customer is told; the business is not
 * pushed about its own change.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const { date, startTime } = parsed.data;

    const booking = await movable(id);
    if (!booking) return err("الحجز غير موجود", 404, { code: "not-found" });

    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return err("الحجز ده مينفعش يتغيّر ميعاده", 400, { code: "not-changeable" });
    }

    const availability = await loadAvailability({
      businessId: booking.businessId,
      serviceId: booking.serviceId,
      date,
      staffMemberId: booking.staffMemberId,
      resourceId: booking.resourceId,
      branchId: booking.branchId,
      excludeBookingId: booking.id,
    });
    if (!availability.slots.includes(startTime)) {
      return err("الموعد ده مش متاح، اختر وقت تاني", 409, { code: "slot-unavailable", reason: availability.reason ?? null });
    }

    const endTime = minutesToTime(timeToMinutes(startTime) + booking.service.duration);
    const { startsAt, endsAt } = bookingInstants(date, startTime, endTime, booking.service.duration);

    try {
      await db.booking.update({
        where: { id: booking.id },
        data: { date: dateToUTC(date), startTime, endTime, startsAt, endsAt, customerReminderSentAt: null },
      });
    } catch (e) {
      const message = e instanceof Prisma.PrismaClientKnownRequestError ? e.message : String(e);
      if (message.includes("booking_no_overlap")) {
        return err("حد تاني حجز الموعد ده دلوقتي، اختر وقت تاني", 409, { code: "slot-taken" });
      }
      throw e;
    }

    void notify({
      type: "booking.rescheduled",
      bookingId: booking.id,
      movedTo: `${date}T${startTime}`,
      movedFrom: `${booking.date.toISOString().slice(0, 10)}T${booking.startTime}`,
      by: "business",
    });

    return ok({ id: booking.id, date, startTime, endTime, status: booking.status });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business reschedule]", e);
    return err("حصلت مشكلة وإحنا بنغيّر الميعاد، جرّب تاني بعد شوية", 500);
  }
}
