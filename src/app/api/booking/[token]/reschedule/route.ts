import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { timeToMinutes, minutesToTime } from "@/lib/bookings/time";
import { loadAvailability } from "@/lib/bookings/schedule";
import { bookingInstants, dateToUTC } from "@/lib/bookings/instants";
import { Prisma } from "@prisma/client";
import { notify } from "@/lib/notifications";
import { log } from "@/lib/logger";
import { CUTOFF_HOURS, minutesUntilStart } from "@/lib/bookings/self-service";

type Params = { params: Promise<{ token: string }> };

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
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });

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

    if (!booking) return err("الحجز غير موجود", 404, { code: "not-found" });

    // ── Status gate ──────────────────────────────────────────────────────────
    // ARRIVED and IN_PROGRESS are deliberately absent: once somebody is
    // in the building, moving the appointment is the owner's job, not a
    // self-service action.
    if (!["PENDING", "CONFIRMED"].includes(booking.status)) {
      return err("الحجز ده مينفعش يتغيّر ميعاده", 400, { code: "not-changeable" });
    }

    // ── Current booking must still be far enough ahead, on Cairo's clock ────
    if (minutesUntilStart(booking.date, booking.startTime) <= CUTOFF_HOURS * 60) {
      return err("مينفعش تغيّر الميعاد لما يكون فاضل عليه ساعتين أو أقل", 400, { code: "too-late" });
    }

    // ── Is the new time actually available? ─────────────────────────────────
    //
    // The same engine the slots endpoint uses, with this booking excluded
    // so it can move within the day it already occupies. Every rule
    // applies: hours, staff, breaks, holidays, notice, advance window.
    const newDateUTC = dateToUTC(newDate);

    const availability = await loadAvailability({
      businessId:       booking.businessId,
      serviceId:        booking.serviceId,
      date:             newDate,
      staffMemberId:    booking.staffMemberId,
      resourceId:          booking.resourceId,
      branchId:         booking.branchId,
      excludeBookingId: booking.id,
    });

    if (!availability.slots.includes(newStartTime)) {
      return err(
        availability.reason === "past"
          ? "لا يمكن الحجز في تاريخ ماضٍ"
          : "الموعد ده مش متاح، اختر وقت تاني",
        409,
        { code: "slot-unavailable", reason: availability.reason },
      );
    }

    const candidateStart = timeToMinutes(newStartTime);
    const candidateEnd   = candidateStart + booking.service.duration;
    const newEndTime     = minutesToTime(candidateEnd);

    // startsAt/endsAt move with the appointment. They are what the
    // overlap constraint is defined over, so leaving them behind would
    // have the database guarding the old time and ignoring the new one.
    const { startsAt, endsAt } = bookingInstants(
      newDate,
      newStartTime,
      newEndTime,
      booking.service.duration,
    );

    // ── Persist ──────────────────────────────────────────────────────────────
    let updated;
    try {
      updated = await db.booking.update({
        where: { id: booking.id },
        data: {
          date:                  newDateUTC,
          startTime:             newStartTime,
          endTime:               newEndTime,
          startsAt,
          endsAt,
          status:                "PENDING",      // reset so owner reviews new time
          customerReminderSentAt: null,           // reset so reminder fires for new date
        },
      });
    } catch (e) {
      // Somebody took the slot between the check above and this write.
      const message = e instanceof Prisma.PrismaClientKnownRequestError ? e.message : String(e);
      if (message.includes("booking_no_overlap")) {
        return err("حد تاني حجز الموعد ده دلوقتي، اختر وقت تاني", 409, { code: "slot-taken" });
      }
      throw e;
    }

    // One call for both sides. Note this now respects the WhatsApp
    // plan gate, which this route never checked while the booking route
    // always did — a free plan was getting a paid channel here only.
    void notify({
      type: "booking.rescheduled",
      bookingId: booking.id,
      movedTo: `${newDate}T${newStartTime}`,
      movedFrom: `${booking.date.toISOString().slice(0, 10)}T${booking.startTime}`,
    });

    return ok({
      date:      newDate,
      startTime: newStartTime,
      endTime:   newEndTime,
      status:    updated.status,
    });
  } catch (e) {
    log.error("[booking reschedule]", e);
    return err("حصلت مشكلة وإحنا بنغيّر الميعاد، جرّب تاني بعد شوية", 500);
  }
}
