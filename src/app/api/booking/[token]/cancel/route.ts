import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { log } from "@/lib/logger";
import { NOTIFY_COPY, notifyCustomer } from "@/lib/account/notify";

type Params = { params: Promise<{ token: string }> };

const CANCELLABLE_STATUSES = ["PENDING", "CONFIRMED"] as const;
/** Minimum hours before appointment that cancellation is allowed */
const CUTOFF_HOURS = 2;

export async function POST(_req: Request, { params }: Params) {
  try {
    const { token } = await params;

    const booking = await db.booking.findUnique({
      where:   { accessToken: token },
      include: { business: { select: { nameAr: true } } },
    });

    if (!booking) return err("الحجز غير موجود", 404);

    // Status check
    if (!(CANCELLABLE_STATUSES as readonly string[]).includes(booking.status)) {
      return err("لا يمكن إلغاء هذا الحجز", 400);
    }

    // Future check — booking date + startTime must be > now + CUTOFF_HOURS
    const [h, m] = booking.startTime.split(":").map(Number);
    const bookingDateTime = new Date(booking.date);
    bookingDateTime.setUTCHours(h, m, 0, 0);
    const cutoff = new Date(Date.now() + CUTOFF_HOURS * 60 * 60 * 1000);

    if (bookingDateTime <= cutoff) {
      return err(
        `لا يمكن الإلغاء قبل أقل من ${CUTOFF_HOURS} ساعات من الموعد`,
        400,
      );
    }

    await db.booking.update({
      where: { id: booking.id },
      data:  { status: "CANCELLED" },
    });

    void notifyCustomer({
      phone: booking.customerPhone,
      ...NOTIFY_COPY.cancelled(booking.business.nameAr),
      href: "/account/history",
      bookingId: booking.id,
    });

    return ok({ cancelled: true });
  } catch (e) {
    log.error("[booking cancel]", e);
    return err("حدث خطأ أثناء الإلغاء", 500);
  }
}
