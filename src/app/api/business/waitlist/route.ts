import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireBusinessAccess } from "@/lib/business-access";
import { businessHandle } from "@/lib/business/route";
import { cairoDateString, dateToUTC } from "@/lib/bookings/instants";

/**
 * GET /api/business/waitlist?date= — who waits for a time that day, in
 * the order they will be offered one (oldest first), and any offer out.
 * Managers and the owner; the customer's number is shown so the desk can
 * call instead.
 */
export async function GET(req: Request) {
  return businessHandle("waitlist GET", async () => {
    const { business } = await requireBusinessAccess("bookings.readAll");
    const date = new URL(req.url).searchParams.get("date") ?? cairoDateString();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return err("تاريخ غير صحيح", 422);
    const rows = await db.slotWaitlistEntry.findMany({
      where: { businessId: business.id, date: dateToUTC(date) },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      take: 100,
      select: {
        id: true, serviceId: true, staffMemberId: true, fromTime: true, toTime: true, partySize: true,
        customerName: true, customerPhone: true, status: true, offeredTime: true, offerExpiresAt: true,
        offers: true, bookingId: true, createdAt: true,
      },
    });
    return ok({ date, entries: rows });
  });
}
