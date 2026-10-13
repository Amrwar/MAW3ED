import { type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { ownerBookingSchema } from "@/lib/validations";
import { ok, err, requireBusiness } from "@/lib/api";
import { timeToMinutes, minutesToTime } from "@/lib/bookings/time";
import { bookingInstants, dateToUTC } from "@/lib/bookings/instants";
import { generateReference } from "@/lib/bookings/reference";
import { getEffectivePlan, getMonthlyBookingLimit, type Plan, type SubscriptionStatus } from "@/lib/plans";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";

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
    const dateFrom  = searchParams.get("dateFrom");
    const dateTo    = searchParams.get("dateTo");
    const search    = searchParams.get("search")?.trim();
    const page      = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit     = 25;

    const where: Prisma.BookingWhereInput = { businessId: business.id };

    if (status && status !== "ALL") {
      where.status = status as Prisma.EnumBookingStatusFilter;
    }
    if (serviceId) {
      where.serviceId = serviceId;
    }

    // Date range takes priority over single-date filter
    if (dateFrom || dateTo) {
      const range: { gte?: Date; lte?: Date } = {};
      if (dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
        const [y, m, d] = dateFrom.split("-").map(Number);
        range.gte = new Date(Date.UTC(y, m - 1, d));
      }
      if (dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        const [y, m, d] = dateTo.split("-").map(Number);
        range.lte = new Date(Date.UTC(y, m - 1, d));
      }
      where.date = range;
    } else if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
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
          service:     { select: { nameAr: true, duration: true } },
          customer:    { select: { notes: true } },
          table:       { select: { name: true } },
          staffMember: { select: { nameAr: true } },
        },
        orderBy: [{ date: "desc" }, { startTime: "asc" }],
        take:    limit,
        skip:    (page - 1) * limit,
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
      depositAmount:   b.depositAmount !== null ? Number(b.depositAmount) : null,
      currency:        b.currency,
      notes:           b.notes,
      customerNotes:   b.customer?.notes ?? null,
      createdAt:       b.createdAt.toISOString(),
      tableName:       b.table?.name        ?? null,
      staffName:       b.staffMember?.nameAr ?? null,
      partySize:       b.partySize           ?? null,
    }));

    return ok({ bookings: serialized, total, page, totalPages: Math.ceil(total / limit), limit });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[bookings GET]", e);
    return err("حدث خطأ", 500);
  }
}

/**
 * POST /api/business/bookings
 * Create a manual booking (by the business owner on behalf of a customer).
 * Status defaults to CONFIRMED.
 */
export async function POST(req: Request) {
  try {
    const { business } = await requireBusiness();
    const body   = await req.json();
    const parsed = ownerBookingSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { serviceId, date, startTime, customerName, customerPhone, notes } = parsed.data;

    // ── Enforce monthly booking limit ─────────────────────────────────────────
    const effectivePlan = getEffectivePlan(
      business.plan as Plan,
      business.subscriptionStatus as SubscriptionStatus,
      business.trialEndsAt,
    );
    const monthlyLimit = getMonthlyBookingLimit(effectivePlan);
    if (isFinite(monthlyLimit)) {
      const now        = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
      const count = await db.booking.count({
        where: {
          businessId: business.id,
          createdAt:  { gte: monthStart, lt: monthEnd },
          status:     { notIn: ["FAILED_PAYMENT", "CANCELLED"] },
        },
      });
      if (count >= monthlyLimit) {
        return err(`بلغت الحد الأقصى (${monthlyLimit}) من الحجوزات الشهرية. يرجى الترقية للاستمرار`, 429);
      }
    }

    // Validate service belongs to this business
    const service = await db.service.findFirst({
      where: { id: serviceId, businessId: business.id },
    });
    if (!service) return err("الخدمة غير موجودة", 404);

    const dateUTC = dateToUTC(date);
    const endTime = minutesToTime(timeToMinutes(startTime) + service.duration);
    const { startsAt, endsAt } = bookingInstants(date, startTime, endTime, service.duration);

    // Upsert customer
    const customer = await db.customer.upsert({
      where:  { businessId_phone: { businessId: business.id, phone: customerPhone } },
      create: { businessId: business.id, name: customerName, phone: customerPhone },
      update: { name: customerName },
    });

    // Create booking (CONFIRMED by default for manual bookings).
    //
    // The owner is allowed to write into a slot the public rules would
    // refuse — squeezing someone in outside opening hours is their call,
    // and blocking it would be a regression. What they cannot do is
    // double-book: the exclusion constraint applies to this path too,
    // and the violation is reported rather than swallowed.
    let booking;
    try {
      booking = await db.booking.create({
        data: {
          businessId:    business.id,
          serviceId,
          customerId:    customer.id,
          customerName,
          customerPhone,
          date:          dateUTC,
          startTime,
          endTime,
          startsAt,
          endsAt,
          reference:     generateReference(),
          status:        "CONFIRMED",
          totalPrice:    service.price,
          currency:      service.currency,
          notes:         notes || null,
        },
        include: {
          service:  { select: { nameAr: true, duration: true } },
          business: { include: { owner: { select: { email: true } } } },
        },
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("booking_no_overlap")) {
        return err("هذا الموعد يتعارض مع حجز موجود، اختر وقتًا آخر", 409);
      }
      throw e;
    }

    // A booking the business typed in itself used to email the owner —
    // who had just created it — and tell the customer nothing at all.
    // The customer gets their confirmation now, and the owner's alert
    // is still sent, mutable from their notification settings.
    void notify({ type: "booking.created", bookingId: booking.id, by: "business" });

    return ok(
      {
        id:              booking.id,
        customerName:    booking.customerName,
        customerPhone:   booking.customerPhone,
        serviceName:     booking.service.nameAr,
        serviceDuration: booking.service.duration,
        date:            booking.date.toISOString().split("T")[0],
        startTime:       booking.startTime,
        endTime:         booking.endTime,
        status:          booking.status,
        totalPrice:      Number(booking.totalPrice),
        depositAmount:   null,
        currency:        booking.currency,
        notes:           booking.notes,
        customerNotes:   null,
        createdAt:       booking.createdAt.toISOString(),
        tableName:       null,
        staffName:       null,
        partySize:       null,
      },
      201
    );
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[bookings POST]", e);
    return err("حدث خطأ أثناء إنشاء الحجز", 500);
  }
}
