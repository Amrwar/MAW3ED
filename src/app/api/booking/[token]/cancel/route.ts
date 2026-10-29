import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { notifyLater } from "@/lib/notifications";
import { customerMayCancel } from "@/lib/bookings/self-service";
import { canTransition } from "@/lib/bookings/transitions";
import { moveBooking } from "@/lib/bookings/state";

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
    if (!canTransition(booking.status, "CANCELLED", "customer")) {
      return err("لا يمكن إلغاء هذا الحجز", 400, { code: "not-cancellable" });
    }
    if (!customerMayCancel(booking)) {
      return err("لا يمكن إلغاء الحجز قبل الموعد بأقل من ساعتين", 400, { code: "too-late" });
    }

    const awaitingPayment = booking.status === "PENDING_PAYMENT";

    // Conditional on the status read above, so a deposit landing in the
    // same moment (which confirms it) is not overwritten by a cancel.
    // Also closes the payment page in the ledger — paid anyway, the
    // webhook records the money and flags it for a refund rather than
    // reviving a cancelled booking — and hands any discount back.
    const move = await moveBooking({
      bookingId: booking.id,
      from: booking.status,
      to: "CANCELLED",
      by: "customer",
      reason: "booking cancelled by the customer",
    });
    if (!move.moved) {
      return err("الحجز اتغيّر دلوقتي، حدّث الصفحة وجرّب تاني", 409, { code: "changed" });
    }

    if (awaitingPayment) {
      // The business was never told about a booking that was not paid
      // for, so there is nothing to tell it now, and the customer did
      // this themselves.
      return ok({ cancelled: true });
    }

    // The business hears about this too now — somebody not turning up
    // to a slot they are holding is the business's news as much as the
    // customer's, and only the customer was being told.
    notifyLater({ type: "booking.cancelled", bookingId: booking.id, by: "customer" });

    // A deposit already paid is not refunded by cancelling: that is the
    // business's policy and a person's decision. The page says so, and
    // this says how much is at stake, from the ledger.
    return ok({ cancelled: true, paidCents: move.refundNeededCents });
  } catch (e) {
    log.error("[booking cancel]", e);
    return err("حدث خطأ أثناء الإلغاء", 500);
  }
}
