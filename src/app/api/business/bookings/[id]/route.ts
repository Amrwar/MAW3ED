import { db } from "@/lib/db";
import { bookingStatusSchema } from "@/lib/validations";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { NOTIFY_COPY, notifyCustomer } from "@/lib/account/notify";
import { formatWhen } from "@/lib/account/when";

type Params = { params: Promise<{ id: string }> };

/** Valid status transitions — terminal states (COMPLETED, CANCELLED, NO_SHOW, FAILED_PAYMENT) cannot be changed */
const VALID_TRANSITIONS: Partial<Record<string, string[]>> = {
  PENDING_PAYMENT: ["CANCELLED"],                      // owner can cancel awaiting-payment bookings
  PENDING:         ["CONFIRMED", "CANCELLED"],
  CONFIRMED:       ["COMPLETED", "CANCELLED", "NO_SHOW"],
};

/**
 * GET /api/business/bookings/[id]
 * Returns full booking details including customer record.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const booking = await db.booking.findFirst({
      where:   { id, businessId: business.id },
      include: {
        service:  { select: { nameAr: true, nameEn: true, duration: true, price: true } },
        customer: { select: { id: true, name: true, phone: true, notes: true } },
      },
    });

    if (!booking) return err("الحجز غير موجود", 404);

    return ok({
      ...booking,
      date:       booking.date.toISOString().split("T")[0],
      totalPrice: Number(booking.totalPrice),
      createdAt:  booking.createdAt.toISOString(),
      updatedAt:  booking.updatedAt.toISOString(),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[booking [id]]", e);
    return err("حدث خطأ", 500);
  }
}

/**
 * PATCH /api/business/bookings/[id]
 * Updates booking status. Enforces valid transition rules.
 *
 * Body: { status: "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW" }
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const body   = await req.json();
    const parsed = bookingStatusSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { status: newStatus } = parsed.data;

    // Verify ownership
    const booking = await db.booking.findFirst({
      where: { id, businessId: business.id },
    });
    if (!booking) return err("الحجز غير موجود", 404);

    // Check transition is valid
    const allowed = VALID_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return err(
        `لا يمكن تغيير الحالة من "${booking.status}" إلى "${newStatus}"`,
        400,
      );
    }

    // Recorded for the customer's account before the response goes
    // back, so the badge is already right when they open it.
    const copy =
      newStatus === "CONFIRMED"
        ? NOTIFY_COPY.confirmed(business.nameAr, formatWhen(booking.date, booking.startTime))
        : newStatus === "CANCELLED"
          ? NOTIFY_COPY.cancelled(business.nameAr)
          : newStatus === "COMPLETED"
            ? NOTIFY_COPY.completed(business.nameAr)
            : null;

    if (copy) {
      void notifyCustomer({
        phone: booking.customerPhone,
        ...copy,
        href: booking.accessToken ? `/booking/${booking.accessToken}` : "/account",
        bookingId: booking.id,
      });
    }

    const updated = await db.booking.update({
      where: { id },
      data:  { status: newStatus },
    });

    return ok({ id: updated.id, status: updated.status });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[bookings PATCH]", e);
    return err("حدث خطأ أثناء تحديث الحالة", 500);
  }
}
