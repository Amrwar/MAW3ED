import { db } from "@/lib/db";
import { ApiError, apiHandle, decodeCursor, encodeCursor, pageParams, requireApiClient } from "@/lib/enterprise/auth";
import { seesBookings, visibleBusinesses } from "@/lib/enterprise/visibility";
import { addDays, dateToUTC } from "@/lib/bookings/instants";

/**
 * GET /api/v1/bookings?businessId=&from=YYYY-MM-DD&to=YYYY-MM-DD&limit=&cursor=
 *
 * One business's bookings by appointment day (at most 31 days per call),
 * only where the organization OWNS or MANAGES it and was granted
 * RESERVATIONS — otherwise 404, the same answer as a business that does
 * not exist. Ids, times and statuses; never the customer's name, phone or
 * email.
 */
export async function GET(req: Request) {
  return apiHandle(async () => {
    const c = await requireApiClient(req, "bookings:read");
    const q = new URL(req.url).searchParams;
    const businessId = q.get("businessId") ?? "";
    const from = q.get("from") ?? "";
    const to = q.get("to") ?? from;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from || to > addDays(from, 30)) {
      throw new ApiError(400, "bad-range");
    }
    const v = (await visibleBusinesses(c.organizationId)).find((x) => x.businessId === businessId);
    if (!v || !seesBookings(v)) throw new ApiError(404, "not-found");
    const { limit, cursor } = pageParams(req);
    const after = decodeCursor(cursor);
    const afterAt = after && after.length === 2 ? new Date(after[0]) : null;
    const rows = await db.booking.findMany({
      where: {
        businessId,
        isTest: false,
        date: { gte: dateToUTC(from), lte: dateToUTC(to) },
        ...(v.branchIds ? { branchId: { in: v.branchIds } } : {}),
        ...(afterAt && !Number.isNaN(afterAt.getTime())
          ? { OR: [{ startsAt: { gt: afterAt } }, { startsAt: afterAt, id: { gt: after![1] } }] }
          : {}),
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: limit + 1,
      select: {
        id: true, reference: true, status: true, date: true, startTime: true, endTime: true, startsAt: true,
        serviceId: true, staffMemberId: true, resourceId: true, branchId: true, partySize: true, source: true,
        createdAt: true, updatedAt: true,
      },
    });
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return Response.json({
      data: page.map((b) => ({
        id: b.id, reference: b.reference, status: b.status, date: b.date.toISOString().slice(0, 10),
        startTime: b.startTime, endTime: b.endTime, serviceId: b.serviceId, staffMemberId: b.staffMemberId,
        resourceId: b.resourceId, branchId: b.branchId, partySize: b.partySize, source: b.source,
        createdAt: b.createdAt, updatedAt: b.updatedAt,
      })),
      nextCursor: rows.length > limit && last?.startsAt ? encodeCursor([last.startsAt.toISOString(), last.id]) : null,
    });
  });
}
