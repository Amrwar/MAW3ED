import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";
import { customerMayCancel } from "@/lib/bookings/self-service";

type Params = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { token } = await params;

    const booking = await db.booking.findUnique({
      where:   { accessToken: token },
      include: { business: { select: { nameAr: true } } },
    });

    if (!booking) return err("الحجز غير موجود", 404, { code: "not-found" });

    // Status check. A booking still waiting on its deposit may be let go
    // at any point before it starts; the rest follow the cutoff — see
    // self-service.ts.
    if (!["PENDING", "CONFIRMED", "PENDING_PAYMENT"].includes(booking.status)) {
      return err("لا يمكن إلغاء هذا الحجز", 400, { code: "not-cancellable" });
    }
    if (!customerMayCancel(booking)) {
      return err("لا يمكن إلغاء الحجز قبل الموعد بأقل من ساعتين", 400, { code: "too-late" });
    }

    const awaitingPayment = booking.status === "PENDING_PAYMENT";

    // Conditional on the status read above, so a deposit landing in the
    // same moment (which confirms it) is not overwritten by a cancel.
    const moved = await db.booking.updateMany({
      where: { id: booking.id, status: booking.status },
      data:  { status: "CANCELLED" },
    });
    if (moved.count === 0) {
      return err("الحجز اتغيّر دلوقتي، حدّث الصفحة وجرّب تاني", 409, { code: "changed" });
    }

    if (awaitingPayment) {
      // Its payment page is closed, so nothing is still waiting on it.
      // Paid anyway, the webhook records the money and flags it for a
      // refund rather than reviving a cancelled booking.
      await db.payment.updateMany({
        where: { bookingId: booking.id, status: "PENDING" },
        data:  { status: "ABANDONED", failureReason: "booking cancelled by the customer before paying" },
      });
      // The business was never told about a booking that was not paid
      // for, so there is nothing to tell it now, and the customer did
      // this themselves.
      return ok({ cancelled: true });
    }

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
