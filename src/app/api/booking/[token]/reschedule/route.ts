import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { hasBookingConflict, timeToMinutes, minutesToTime } from "@/lib/bookings/overlap";
import { bookingPageUrl } from "@/lib/url";
import {
  sendRescheduleConfirmationToCustomer,
  sendRescheduleAlertToBusiness,
  type BookingEmailData,
} from "@/lib/services/email";
import {
  sendCustomerConfirmationTemplate,
  sendBusinessBookingTemplate,
} from "@/lib/services/whatsapp";
import type { BookingNotificationData } from "@/lib/services/whatsapp-messages";

type Params = { params: Promise<{ token: string }> };

/** Minimum hours before appointment that rescheduling is allowed */
const CUTOFF_HOURS = 2;

const rescheduleSchema = z.object({
  date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "وقت غير صحيح"),
});

/**
 * POST /api/booking/[token]/reschedule
 *
 * Reschedules an existing booking to a new date + time without creating a new
 * booking record. Enforces the same conflict-detection rules as the creation
 * flow, with the current booking excluded from the check (a booking can be
 * "moved" to a slot that it already occupies on the same day).
 *
 * After a successful reschedule:
 *   - status resets to PENDING so the business owner reviews the new time
 *   - customerReminderSentAt is cleared so the reminder fires for the new date
 *   - WhatsApp + email notifications are sent to both parties (fire-and-forget)
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { token } = await params;

    const body   = await req.json();
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { date: newDate, startTime: newStartTime } = parsed.data;

    // ── Look up booking by access token ─────────────────────────────────────
    const booking = await db.booking.findUnique({
      where:   { accessToken: token },
      include: {
        business: {
          select: {
            nameAr:   true,
            whatsapp: true,
            phone:    true,
            owner:    { select: { email: true } },
          },
        },
        service:  { select: { nameAr: true, duration: true } },
        customer: { select: { email: true } },
      },
    });

    if (!booking) return err("الحجز غير موجود", 404);

    // ── Status gate ──────────────────────────────────────────────────────────
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return err("لا يمكن إعادة جدولة هذا الحجز", 400);
    }

    // ── Current booking must still be far enough in the future ──────────────
    const [ch, cm]        = booking.startTime.split(":").map(Number);
    const currentDateTime = new Date(booking.date);
    currentDateTime.setUTCHours(ch, cm, 0, 0);
    const cutoff = new Date(Date.now() + CUTOFF_HOURS * 60 * 60 * 1000);

    if (currentDateTime <= cutoff) {
      return err(
        `لا يمكن إعادة الجدولة قبل أقل من ${CUTOFF_HOURS} ساعات من الموعد الحالي`,
        400,
      );
    }

    // ── New date must not be in the past (Egypt timezone) ───────────────────
    const nowEgyptStr = new Date().toLocaleDateString("en-CA", {
      timeZone: "Africa/Cairo",
    });
    const [ty, tm, td] = nowEgyptStr.split("-").map(Number);
    const todayUTC     = new Date(Date.UTC(ty, tm - 1, td));

    const [ny, nm, nd] = newDate.split("-").map(Number);
    const newDateUTC   = new Date(Date.UTC(ny, nm - 1, nd));

    if (newDateUTC < todayUTC) return err("لا يمكن الحجز في تاريخ ماضٍ", 400);

    // ── Compute new end time ─────────────────────────────────────────────────
    const candidateStart = timeToMinutes(newStartTime);
    const candidateEnd   = candidateStart + booking.service.duration;
    const newEndTime     = minutesToTime(candidateEnd);

    // ── Conflict check (exclude the booking being rescheduled) ──────────────
    const conflict = await hasBookingConflict(
      booking.businessId,
      newDateUTC,
      candidateStart,
      candidateEnd,
      { excludeBookingId: booking.id }, // ← exclude self so a booking can move within the same day
    );
    if (conflict) return err("هذا الموعد محجوز بالفعل، اختر وقتًا آخر", 409);

    // ── Persist ──────────────────────────────────────────────────────────────
    const updated = await db.booking.update({
      where: { id: booking.id },
      data: {
        date:                  newDateUTC,
        startTime:             newStartTime,
        endTime:               newEndTime,
        status:                "PENDING",      // reset so owner reviews new time
        customerReminderSentAt: null,           // reset so reminder fires for new date
      },
    });

    // ── Notifications (fire-and-forget) ──────────────────────────────────────
    const bookingUrl = bookingPageUrl(token);

    const notifData: BookingNotificationData = {
      businessName:  booking.business.nameAr,
      serviceName:   booking.service.nameAr,
      date:          newDate,
      startTime:     newStartTime,
      endTime:       newEndTime,
      customerName:  booking.customerName,
      customerPhone: booking.customerPhone,
      totalPrice:    Number(booking.totalPrice),
      currency:      booking.currency,
      bookingUrl,
    };

    const emailData: BookingEmailData = {
      ...notifData,
      notes: booking.notes,
      bookingUrl,
    };

    // Business owner — WhatsApp
    const businessPhone = booking.business.whatsapp ?? booking.business.phone;
    if (businessPhone) void sendBusinessBookingTemplate(businessPhone, notifData);

    // Customer — WhatsApp confirmation
    void sendCustomerConfirmationTemplate(booking.customerPhone, notifData);

    // Business owner — email
    if (booking.business.owner.email) {
      void sendRescheduleAlertToBusiness(booking.business.owner.email, emailData);
    }

    // Customer — email (only if on file)
    if (booking.customer?.email) {
      void sendRescheduleConfirmationToCustomer(booking.customer.email, emailData);
    }

    return ok({
      date:      newDate,
      startTime: newStartTime,
      endTime:   newEndTime,
      status:    updated.status,
    });
  } catch (e) {
    console.error("[booking reschedule]", e);
    return err("حدث خطأ أثناء إعادة الجدولة", 500);
  }
}
