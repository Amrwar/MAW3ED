import { db } from "@/lib/db";
import { err } from "@/lib/api";
import { buildIcs } from "@/lib/bookings/ics";
import { minutesToTime, timeToMinutes } from "@/lib/bookings/time";
import { siteUrl } from "@/lib/env";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ token: string }> };

/**
 * GET /api/public/booking/[token]/calendar
 *
 * The appointment as an .ics download.
 *
 * The access token is the authorisation, exactly as it is for the
 * booking page itself — the customer has the link, nobody else does.
 * Nothing in the file identifies anyone but the business.
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { token } = await params;
    if (!token || token.length < 16) return err("رابط غير صالح", 400);

    const booking = await db.booking.findUnique({
      where: { accessToken: token },
      select: {
        id: true,
        reference: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        updatedAt: true,
        service: { select: { nameAr: true, duration: true } },
        business: {
          select: {
            nameAr: true,
            address: true,
            phone: true,
            city: { select: { nameAr: true } },
          },
        },
        branch: { select: { nameAr: true, address: true } },
      },
    });

    if (!booking) return err("لم يتم العثور على هذا الحجز", 404);

    const date = booking.date.toISOString().slice(0, 10);
    const endTime =
      booking.endTime ??
      minutesToTime(timeToMinutes(booking.startTime) + booking.service.duration);

    const where = booking.branch
      ? [booking.branch.nameAr, booking.branch.address].filter(Boolean).join(" — ")
      : [booking.business.address, booking.business.city.nameAr].filter(Boolean).join("، ");

    const ics = buildIcs({
      // Stable per booking, so adding it twice updates the same event.
      uid: `${booking.id}@maw3ed.net`,
      title: `${booking.service.nameAr} — ${booking.business.nameAr}`,
      description: [
        `رقم الحجز: ${booking.reference ?? ""}`.trim(),
        booking.business.phone ? `هاتف: ${booking.business.phone}` : null,
        `${siteUrl}/booking/${token}`,
      ]
        .filter(Boolean)
        .join("\n"),
      location: where || booking.business.nameAr,
      date,
      startTime: booking.startTime,
      endTime,
      // Every reschedule touches updatedAt, so the sequence climbs and
      // calendars treat the next download as an update, not a duplicate.
      sequence: Math.floor(booking.updatedAt.getTime() / 1000),
      url: `${siteUrl}/booking/${token}`,
      status: booking.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED",
    });

    const filename = `maw3ed-${booking.reference ?? booking.id}.ics`;

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    log.error("[booking calendar]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
