import { db } from "@/lib/db";
import { bookingStatusSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import { bookingScope, can, permissionsOf, requireBusinessAccess, type BusinessAction } from "@/lib/business-access";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

/** Valid status transitions — terminal states (COMPLETED, CANCELLED, NO_SHOW, FAILED_PAYMENT) cannot be changed */
const VALID_TRANSITIONS: Partial<Record<string, string[]>> = {
  PENDING_PAYMENT: ["CANCELLED"],                      // owner can cancel awaiting-payment bookings
  PENDING:         ["CONFIRMED", "CANCELLED"],
  // The day-of path: the customer turns up, the work starts, it ends.
  // ARRIVED and IN_PROGRESS existed in BookingStatus, in the labels and
  // in booking_no_overlap, but nothing could set them — so an owner
  // could only jump straight from CONFIRMED to COMPLETED and the two
  // states were decoration.
  //
  // COMPLETED stays reachable directly from CONFIRMED: a busy owner
  // marking a finished appointment should not have to walk through two
  // intermediate states first.
  CONFIRMED:       ["ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
  ARRIVED:         ["IN_PROGRESS", "COMPLETED", "NO_SHOW", "CANCELLED"],
  IN_PROGRESS:     ["COMPLETED", "CANCELLED"],
};

/** The permission a move to `status` needs (lib/business-access.ts). */
function actionFor(status: string): BusinessAction {
  if (status === "CONFIRMED") return "bookings.confirm";
  if (status === "CANCELLED") return "bookings.cancel";
  return "bookings.progress";
}

/**
 * GET /api/business/bookings/[id]
 * Returns full booking details including customer record.
 *
 * Found within what the caller may see — a provider's own bookings, the
 * owner's or a manager's whole business — so an id from anywhere else
 * is simply not found. `actions` is the statuses this caller may move it
 * to, so the app offers exactly those; the PATCH checks again anyway.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { business, actor } = await requireBusinessAccess("bookings.read");
    const { id } = await params;

    const booking = await db.booking.findFirst({
      where:   { id, ...bookingScope(business, actor) },
      include: {
        service:     { select: { nameAr: true, nameEn: true, duration: true, price: true } },
        customer:    { select: { id: true, name: true, phone: true, notes: true } },
        staffMember: { select: { id: true, nameAr: true, nameEn: true } },
        branch:      { select: { id: true, nameAr: true, nameEn: true } },
        resource:    { select: { name: true } },
      },
    });

    if (!booking) return err("الحجز غير موجود", 404);

    const seeCustomers = can(actor, "customers.read");
    const visits = seeCustomers && booking.customerId
      ? await db.booking.count({ where: { businessId: business.id, customerId: booking.customerId, status: "COMPLETED" } })
      : null;

    return ok({
      id:            booking.id,
      reference:     booking.reference,
      status:        booking.status,
      date:          booking.date.toISOString().split("T")[0],
      startTime:     booking.startTime,
      endTime:       booking.endTime,
      customerName:  booking.customerName,
      customerPhone: booking.customerPhone,
      notes:         booking.notes,
      partySize:     booking.partySize,
      totalPrice:    Number(booking.totalPrice),
      depositAmount: booking.depositAmount !== null ? Number(booking.depositAmount) : null,
      currency:      booking.currency,
      service:       booking.service ? { ...booking.service, price: Number(booking.service.price) } : null,
      staffMember:   booking.staffMember,
      branch:        booking.branch,
      resourceName:  booking.resource?.name ?? null,
      // The customer record — notes, history — is the customer book,
      // which a provider does not have.
      customer:      seeCustomers && booking.customer ? { ...booking.customer, completedVisits: visits } : null,
      createdAt:     booking.createdAt.toISOString(),
      updatedAt:     booking.updatedAt.toISOString(),
      actions:       (VALID_TRANSITIONS[booking.status] ?? []).filter((s) => can(actor, actionFor(s))),
      canReschedule: can(actor, "bookings.reschedule") && ["PENDING", "CONFIRMED"].includes(booking.status),
      permissions:   permissionsOf(actor),
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
    const { business, actor } = await requireBusinessAccess("bookings.read");
    const { id } = await params;

    const body   = await req.json();
    const parsed = bookingStatusSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { status: newStatus } = parsed.data;

    // Within what this caller may see: another business's booking, or a
    // colleague's for a provider, is not found.
    const booking = await db.booking.findFirst({
      where: { id, ...bookingScope(business, actor) },
    });
    if (!booking) return err("الحجز غير موجود", 404);

    if (!can(actor, actionFor(newStatus))) {
      return err("مش مسموح لك بالإجراء ده", 403, { code: "forbidden" });
    }

    // Check transition is valid
    const allowed = VALID_TRANSITIONS[booking.status] ?? [];
    if (!allowed.includes(newStatus)) {
      return err(
        `لا يمكن تغيير الحالة من "${booking.status}" إلى "${newStatus}"`,
        400,
      );
    }

    const updated = await db.booking.update({
      where: { id },
      data:  { status: newStatus },
    });

    // Told after the update, not before: a notification saying "your
    // booking is confirmed" must not go out if the write that confirms
    // it then fails.
    //
    // There is no REJECTED status — declining is a cancellation — but
    // the two read very differently to a customer. Losing an
    // appointment that was never confirmed is "we could not take it";
    // losing one that was confirmed is "your appointment is off". The
    // previous status is what tells them apart.
    const wasPending = booking.status === "PENDING" || booking.status === "PENDING_PAYMENT";

    if (newStatus === "CONFIRMED") {
      void notify({ type: "booking.confirmed", bookingId: booking.id });
    } else if (newStatus === "CANCELLED") {
      void notify(
        wasPending
          ? { type: "booking.rejected", bookingId: booking.id }
          : { type: "booking.cancelled", bookingId: booking.id, by: "business" },
      );
    } else if (newStatus === "COMPLETED") {
      void notify({ type: "booking.completed", bookingId: booking.id });
    }

    return ok({ id: updated.id, status: updated.status });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[bookings PATCH]", e);
    return err("حدث خطأ أثناء تحديث الحالة", 500);
  }
}
