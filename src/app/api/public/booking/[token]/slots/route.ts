import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { loadAvailability } from "@/lib/bookings/schedule";
import { log } from "@/lib/logger";

/**
 * GET /api/public/booking/[token]/slots?date=YYYY-MM-DD
 *
 * The times this booking could move to. The same engine as the public
 * slots endpoint, with the booking's own service, person, room and
 * branch — and the booking itself left out, so it does not block the
 * times around where it already sits. The reschedule route asks the
 * identical question before it moves anything, so a time offered here is
 * one it will accept unless somebody takes it first.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) return err("رابط غير صالح", 400);

    const date = new URL(req.url).searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return err("تاريخ غير صحيح", 400);

    const booking = await db.booking.findUnique({
      where: { accessToken: token },
      select: { id: true, businessId: true, serviceId: true, staffMemberId: true, resourceId: true, branchId: true, partySize: true },
    });
    if (!booking) return err("لم يتم العثور على هذا الحجز", 404);

    const { slots, reason } = await loadAvailability({
      businessId: booking.businessId,
      serviceId: booking.serviceId,
      date,
      staffMemberId: booking.staffMemberId,
      resourceId: booking.resourceId,
      branchId: booking.branchId,
      partySize: booking.partySize,
      excludeBookingId: booking.id,
    });

    return ok({ slots, reason });
  } catch (e) {
    log.error("[booking slots GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
