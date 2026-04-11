import { type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { bookingSchema } from "@/lib/validations";
import { ok, err, requireBusiness } from "@/lib/api";
import { hasBookingConflict, timeToMinutes, minutesToTime } from "@/lib/bookings/overlap";
import { sendNewBookingAlertToBusiness, type BookingEmailData } from "@/lib/services/email";
import { getEffectivePlan, getMonthlyBookingLimit, type Plan, type SubscriptionStatus } from "@/lib/plans";

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
    console.error("[bookings GET]", e);
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
    const parsed = bookingSchema.safeParse(body);
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

    // Parse date to UTC midnight
    const [y, m, d] = date.split("-").map(Number);
    const dateUTC   = new Date(Date.UTC(y, m - 1, d));

    // Calculate candidate time range
    const candidateStart = timeToMinutes(startTime);
    const candidateEnd   = candidateStart + service.duration;
    const endTime        = minutesToTime(candidateEnd);

    // Range-overlap conflict check (same rule as the public booking flow)
    if (await hasBookingConflict(business.id, dateUTC, candidateStart, candidateEnd)) {
      return err("هذا الموعد يتعارض مع حجز موجود، اختر وقتًا آخر", 409);
    }

    // Upsert customer
    const customer = await db.customer.upsert({
      where:  { businessId_phone: { businessId: business.id, phone: customerPhone } },
      create: { businessId: business.id, name: customerName, phone: customerPhone },
      update: { name: customerName },
    });

    // Create booking (CONFIRMED by default for manual bookings)
    const booking = await db.booking.create({
      data: {
        businessId:    business.id,
        serviceId,
        customerId:    customer.id,
        customerName,
        customerPhone,
        date:          dateUTC,
        startTime,
        endTime,
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

    // ── Email alert to business owner (fire-and-forget) ───────────────────────
    if (booking.business.owner.email) {
      const emailData: BookingEmailData = {
        businessName:  booking.business.nameAr,
        serviceName:   booking.service.nameAr,
        date:          booking.date.toISOString().split("T")[0],
        startTime:     booking.startTime,
        endTime:       booking.endTime ?? "",
        customerName:  booking.customerName,
        customerPhone: booking.customerPhone,
        totalPrice:    Number(booking.totalPrice),
        currency:      booking.currency,
        notes:         booking.notes,
      };
      void sendNewBookingAlertToBusiness(booking.business.owner.email, emailData);
    }

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
    console.error("[bookings POST]", e);
    return err("حدث خطأ أثناء إنشاء الحجز", 500);
  }
}
