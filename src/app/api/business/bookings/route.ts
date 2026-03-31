import { type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";

/**
 * GET /api/business/bookings
 * Returns bookings for the authenticated business with optional filters.
 *
 * Query params:
 *   status    — ALL | PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
 *   serviceId — filter by service
 *   date      — filter by date YYYY-MM-DD
 *   search    — filter by customer name or phone (case-insensitive)
 */
export async function GET(req: Request) {
  try {
    const { business } = await requireBusiness();
    const { searchParams } = new URL(req.url);

    const status    = searchParams.get("status");
    const serviceId = searchParams.get("serviceId");
    const date      = searchParams.get("date");
    const search    = searchParams.get("search")?.trim();

    const where: Prisma.BookingWhereInput = { businessId: business.id };

    if (status && status !== "ALL") {
      where.status = status as Prisma.EnumBookingStatusFilter;
    }
    if (serviceId) {
      where.serviceId = serviceId;
    }
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split("-").map(Number);
      where.date = new Date(Date.UTC(y, m - 1, d));
    }
    if (search) {
      where.OR = [
        { customerName:  { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search } },
      ];
    }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        include: {
          service:  { select: { nameAr: true, duration: true } },
          customer: { select: { notes: true } },
        },
        orderBy: [{ date: "desc" }, { startTime: "asc" }],
        take: 100,
      }),
      db.booking.count({ where }),
    ]);

    const serialized = bookings.map((b) => ({
      id:              b.id,
      customerName:    b.customerName,
      customerPhone:   b.customerPhone,
      serviceName:     b.service.nameAr,
      serviceDuration: b.service.duration,
      date:            b.date.toISOString().split("T")[0],
      startTime:       b.startTime,
      endTime:         b.endTime,
      status:          b.status,
      totalPrice:      Number(b.totalPrice),
      currency:        b.currency,
      notes:           b.notes,
      customerNotes:   b.customer?.notes ?? null,
      createdAt:       b.createdAt.toISOString(),
    }));

    return ok({ bookings: serialized, total });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[bookings GET]", e);
    return err("حدث خطأ", 500);
  }
}
