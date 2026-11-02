import { db } from "@/lib/db";
import { bookingStatusSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import { bookingScope, can, permissionsOf, requireBusinessAccess, type BusinessAction } from "@/lib/business-access";
import { log } from "@/lib/logger";
import { notifyLater } from "@/lib/notifications";
import { ARRIVE_EARLY_MINUTES, allowedNow, isTooEarly } from "@/lib/bookings/progress-guard";
import { CUSTOMER_MOVABLE, canTransition, transitionsFrom } from "@/lib/bookings/transitions";
import { moveBooking } from "@/lib/bookings/state";
import { queueBusyResponse } from "@/lib/bookings/busy";
import { businessPassSummary } from "@/lib/access/passes";

type Params = { params: Promise<{ id: string }> };

// The transition table lives in lib/bookings/transitions.ts, shared with
// the dashboard's buttons and the customer's routes, so no two screens
// disagree about what may follow what.

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
        checkIn:     { select: { checkedInAt: true } },
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
      // Also by the clock (lib/bookings/progress-guard): a booking that
      // has not started cannot be completed or missed, so the app never
      // shows a button the PATCH would refuse with "too-early".
      actions:       allowedNow(transitionsFrom(booking.status, "business"), booking).filter((s) => can(actor, actionFor(s))),
      canReschedule: can(actor, "bookings.reschedule") && (CUSTOMER_MOVABLE as readonly string[]).includes(booking.status),
      permissions:   permissionsOf(actor),
      // Phase 23: checked in by scanning the booking QR, and the state of
      // any visitor passes asked for (counts only — lib/access/passes).
      checkedInAt:   booking.checkIn?.checkedInAt?.toISOString() ?? null,
      visitorPasses: await businessPassSummary(booking.id),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[booking [id]]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/**
 * PATCH /api/business/bookings/[id]
 * Updates booking status. Enforces valid transition rules.
 *
 * Body: { status: "CONFIRMED" | "CANCELLED" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED" | "NO_SHOW" }
 *
 * 409 { code: "too-early" } when the move is ahead of the clock:
 * ARRIVED/IN_PROGRESS before 30 minutes ahead of the start, or
 * COMPLETED/NO_SHOW before the start.
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
    if (!canTransition(booking.status, newStatus, "business")) {
      return err(
        `لا يمكن تغيير الحالة من "${booking.status}" إلى "${newStatus}"`,
        400,
        { code: "not-allowed" },
      );
    }

    // Not before its time: see lib/bookings/progress-guard for the rule.
    if (isTooEarly(newStatus, booking)) {
      return err(
        newStatus === "ARRIVED" || newStatus === "IN_PROGRESS"
          ? `الحالة دي متاحة قبل الموعد بـ ${ARRIVE_EARLY_MINUTES} دقيقة بس`
          : "الحالة دي متاحة بعد ما ميعاد الحجز يبدأ",
        409,
        { code: "too-early" },
      );
    }

    // Conditional on the status read above. The deposit's webhook, the
    // customer's own cancel and a colleague's tap all move the same row;
    // whichever lands second must not overwrite the first unseen.
    // Cancelling also closes any open payment page, hands a discount
    // back and flags money already paid for a refund (lib/bookings/state).
    const move = await moveBooking({
      bookingId: booking.id,
      from: booking.status,
      to: newStatus,
      by: "business",
      actorUserId: actor.userId,
    });
    if (!move.moved) {
      return err("الحجز اتغيّر دلوقتي، حدّث الصفحة وجرّب تاني", 409, { code: "changed" });
    }

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
      notifyLater({ type: "booking.confirmed", bookingId: booking.id, actorUserId: actor.userId });
    } else if (newStatus === "CANCELLED") {
      notifyLater(
        wasPending
          ? { type: "booking.rejected", bookingId: booking.id, actorUserId: actor.userId }
          : { type: "booking.cancelled", bookingId: booking.id, by: "business", actorUserId: actor.userId },
      );
    } else if (newStatus === "COMPLETED") {
      notifyLater({ type: "booking.completed", bookingId: booking.id });
    }

    return ok({
      id: booking.id,
      status: newStatus,
      // Money already taken for a booking that is now off; the app shows
      // the owner a line saying support refunds it, never a promise.
      refundNeededCents: move.refundNeededCents,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    const busy = queueBusyResponse(e);
    if (busy) return busy;
    log.error("[bookings PATCH]", e);
    return err("حدث خطأ أثناء تحديث الحالة", 500);
  }
}
