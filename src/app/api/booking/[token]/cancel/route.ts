import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";
import { CUTOFF_HOURS, minutesUntilStart } from "@/lib/bookings/self-service";

type Params = { params: Promise<{ token: string }> };

const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED"] as const;

export async function POST(_req: Request, { params }: Params) {
  try {
    const { token } = await params;

    const booking = await db.booking.findUnique({
      where:   { accessToken: token },
      include: { business: { select: { nameAr: true } } },
    });

    if (!booking) return err("الحجز غير موجود", 404, { code: "not-found" });

    // Status check
    if (!(CANCELLABLE_STATUSES as readonly string[]).includes(booking.status)) {
      return err("لا يمكن إلغاء هذا الحجز", 400, { code: "not-cancellable" });
    }

    // Far enough ahead, on Cairo's clock — see self-service.ts.
    if (minutesUntilStart(booking.date, booking.startTime) <= CUTOFF_HOURS * 60) {
      return err("لا يمكن إلغاء الحجز قبل الموعد بأقل من ساعتين", 400, { code: "too-late" });
    }

    await db.booking.update({
      where: { id: booking.id },
      data:  { status: "CANCELLED" },
    });

    // The business hears about this too now — somebody not turning up
    // to a slot they are holding is the business's news as much as the
    // customer's, and only the customer was being told.
    void notify({ type: "booking.cancelled", bookingId: booking.id, by: "customer" });

    return ok({ cancelled: true });
  } catch (e) {
    log.error("[booking cancel]", e);
    return err("حدث خطأ أثناء الإلغاء", 500);
  }
}
