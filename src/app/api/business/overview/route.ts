import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { bookingScope, permissionsOf, requireBusinessAccess } from "@/lib/business-access";
import { cairoDateString, cairoMinutes, dateToUTC } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";
import { log } from "@/lib/logger";

/**
 * GET /api/business/overview — the morning look at the business.
 *
 * What an owner (or a staff member, within their scope) needs on opening
 * the app: today's bookings in order, the next appointment, what is
 * waiting for a confirmation, what was cancelled since yesterday, and unread
 * notifications. One request, so the first screen is one round trip.
 *
 * "Today" is Cairo's date, the business's clock — not the phone's.
 */

const LIVE = ["PENDING_PAYMENT", "PENDING", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] as const;

export async function GET() {
  try {
    const { business, actor } = await requireBusinessAccess("bookings.read");
    const scope = bookingScope(business, actor);
    const today = cairoDateString();
    const todayUTC = dateToUTC(today);
    const nowMinutes = cairoMinutes();

    const [todays, pending, cancelledToday, unread, me] = await Promise.all([
      db.booking.findMany({
        where: { ...scope, date: todayUTC, status: { in: [...LIVE] } },
        orderBy: { startTime: "asc" },
        select: {
          id: true,
          reference: true,
          status: true,
          startTime: true,
          endTime: true,
          customerName: true,
          customerPhone: true,
          service: { select: { nameAr: true, nameEn: true } },
          staffMember: { select: { id: true, nameAr: true, nameEn: true } },
          branch: { select: { id: true, nameAr: true, nameEn: true } },
        },
      }),
      // Waiting on the business, today or later — the confirmations queue.
      db.booking.findMany({
        where: { ...scope, status: "PENDING", date: { gte: todayUTC } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 20,
        select: {
          id: true,
          date: true,
          startTime: true,
          customerName: true,
          service: { select: { nameAr: true, nameEn: true } },
          staffMember: { select: { nameAr: true, nameEn: true } },
        },
      }),
      // Cancelled in the last 24 hours: what changed overnight, whatever the date.
      db.booking.findMany({
        where: { ...scope, status: "CANCELLED", updatedAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: { id: true, date: true, startTime: true, customerName: true, service: { select: { nameAr: true, nameEn: true } } },
      }),
      db.notification.count({ where: { userId: actor.userId, readAt: null } }),
      actor.staffMemberId
        ? db.staffMember.findUnique({ where: { id: actor.staffMemberId }, select: { nameAr: true, nameEn: true } })
        : null,
    ]);

    const upcoming = todays.find(
      (b) => ["PENDING", "CONFIRMED", "ARRIVED"].includes(b.status) && timeToMinutes(b.startTime) >= nowMinutes - 15,
    );
    const day = (d: Date) => d.toISOString().split("T")[0];

    return ok({
      today,
      business: { id: business.id, nameAr: business.nameAr, nameEn: business.nameEn, slug: business.slug, logo: business.logoImage },
      actor: { role: actor.role, staffMemberId: actor.staffMemberId, staffName: me ?? null, permissions: permissionsOf(actor) },
      counts: {
        today: todays.filter((b) => b.status !== "NO_SHOW").length,
        pending: pending.length,
        cancelledRecent: cancelledToday.length,
        done: todays.filter((b) => b.status === "COMPLETED").length,
        unreadNotifications: unread,
      },
      next: upcoming ?? null,
      todays,
      pending: pending.map((b) => ({ ...b, date: day(b.date) })),
      cancelled: cancelledToday.map((b) => ({ ...b, date: day(b.date) })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[business overview]", e);
    return err("حدث خطأ", 500);
  }
}
