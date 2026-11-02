import { BookingStatus, type Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { ownerBookingSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import { bookingScope, can, requireBusinessAccess } from "@/lib/business-access";
import { timeToMinutes, minutesToTime } from "@/lib/bookings/time";
import { bookingInstants, dateToUTC } from "@/lib/bookings/instants";
import { inBookingQueue } from "@/lib/bookings/queue";
import { queueBusyResponse } from "@/lib/bookings/busy";
import { generateReference } from "@/lib/bookings/reference";
import { log } from "@/lib/logger";
import { recordBusinessMilestone } from "@/lib/business/lifecycle";
import { notifyLater } from "@/lib/notifications";
import { isoDate, pageParam, parseQuery } from "@/lib/query-params";

/** Query of GET: a bad page, status or date is a 400, not a 500. */
const listQuery = z.object({
  status:    z.union([z.literal("ALL"), z.enum(BookingStatus)]).optional(),
  serviceId: z.string().max(64).optional(),
  date:      isoDate.optional(),
  dateFrom:  isoDate.optional(),
  dateTo:    isoDate.optional(),
  search:    z.string().max(100).optional(),
  staffId:   z.string().max(64).optional(),
  branchId:  z.string().max(64).optional(),
  view:      z.string().max(20).optional(),
  page:      pageParam.optional(),
});

/**
 * GET /api/business/bookings
 * Returns bookings for the authenticated business with optional filters.
 *
 * Query params:
 *   status    — ALL | PENDING | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
 *   serviceId — filter by service
 *   date      — filter by date YYYY-MM-DD
 *   search    — filter by customer name or phone (case-insensitive)
 *   staffId   — one staff member's bookings (owner and manager only)
 *   branchId  — one branch's bookings
 *   view      — "calendar": every booking in dateFrom..dateTo (at most
 *               31 days, up to 500), unpaged, in time order
 *
 * The owner and managers see the whole business; a provider sees only
 * the bookings with them (lib/business-access.ts), whatever they ask for.
 */
export async function GET(req: Request) {
  try {
    const { business, actor } = await requireBusinessAccess("bookings.read");
    const { searchParams } = new URL(req.url);

    const q = parseQuery(searchParams, listQuery);
    if (!q.ok) return q.response;

    const { status, serviceId, date, dateFrom, dateTo, staffId, branchId, page = 1 } = q.data;
    const search    = q.data.search?.trim();
    const calendar  = q.data.view === "calendar";
    const limit     = calendar ? 500 : 25;

    // Built on the actor's scope: a provider's query cannot be widened by
    // any parameter, because their own staff id is part of every where.
    const where: Prisma.BookingWhereInput = { ...bookingScope(business, actor) };

    if (staffId && can(actor, "bookings.readAll")) {
      where.staffMemberId = staffId;
    }
    if (branchId) {
      // Narrows within the scope, never widens it: a delegate limited to
      // some branches asking for another branch gets that branch AND its
      // own — nothing.
      const allowed = actor.role === "DELEGATE" ? actor.delegation?.branchIds : null;
      where.branchId = allowed ? { in: allowed.filter((b) => b === branchId) } : branchId;
    }
    if (calendar) {
      // Both dates in the one format the filter below reads, or the range
      // would be checked and then not applied.
      const iso = /^\d{4}-\d{2}-\d{2}$/;
      const days = dateFrom && dateTo && iso.test(dateFrom) && iso.test(dateTo) ? (Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000 : NaN;
      if (!(days >= 0 && days <= 31)) return err("حدد فترة من يوم لـ 31 يوم", 422, { code: "range" });
    }

    if (status && status !== "ALL") {
      where.status = status;
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
          service:     { select: { nameAr: true, nameEn: true, duration: true } },
          customer:    { select: { notes: true } },
          table:       { select: { name: true } },
          staffMember: { select: { id: true, nameAr: true, nameEn: true } },
          branch:      { select: { id: true, nameAr: true, nameEn: true } },
        },
        // id last, so rows at the same minute keep their order across pages.
        orderBy: calendar ? [{ date: "asc" }, { startTime: "asc" }, { id: "asc" }] : [{ date: "desc" }, { startTime: "asc" }, { id: "asc" }],
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
      serviceNameEn:   b.service.nameEn ?? null,
      reference:       b.reference ?? null,
      isTest:          b.isTest,
      serviceDuration: b.service.duration,
      date:            b.date.toISOString().split("T")[0],
      startTime:       b.startTime,
      endTime:         b.endTime,
      status:          b.status,
      totalPrice:      Number(b.totalPrice),
      depositAmount:   b.depositAmount !== null ? Number(b.depositAmount) : null,
      currency:        b.currency,
      notes:           b.notes,
      // The owner's private notes on a customer are the customer book,
      // which a provider does not have; the detail route hides them too.
      customerNotes:   can(actor, "customers.read") ? (b.customer?.notes ?? null) : null,
      createdAt:       b.createdAt.toISOString(),
      tableName:       b.table?.name        ?? null,
      staffName:       b.staffMember?.nameAr ?? null,
      staffNameEn:     b.staffMember?.nameEn ?? null,
      staffMemberId:   b.staffMember?.id ?? null,
      branchId:        b.branch?.id ?? null,
      branchName:      b.branch?.nameAr ?? null,
      branchNameEn:    b.branch?.nameEn ?? null,
      partySize:       b.partySize           ?? null,
    }));

    return ok({ bookings: serialized, total, page, totalPages: Math.ceil(total / limit), limit });
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[bookings GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

/**
 * POST /api/business/bookings
 * Create a manual booking (by the business owner on behalf of a customer).
 * Status defaults to CONFIRMED.
 */
export async function POST(req: Request) {
  try {
    const { session, business, actor } = await requireBusinessAccess("bookings.create");
    // A booking keyed in here carries no branch, so a delegate limited
    // to some branches would create one outside their own view.
    if (actor.role === "DELEGATE" && actor.delegation?.branchIds) {
      return err("الإدارة المفوّضة على فرع واحد مش بتضيف حجوزات يدوي", 403, { code: "forbidden" });
    }
    const body   = await req.json();
    const parsed = ownerBookingSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { serviceId, date, startTime, customerName, customerPhone, customerEmail, notes } = parsed.data;

    // No monthly limit here. The free plan's allowance decides whether
    // a customer's online booking is confirmed on the spot or waits for
    // the owner (lib/bookings/create, overLimit "hold"); a booking the
    // owner keys in is already theirs, and refusing it made the owner
    // the one person past the limit who could not add a booking.

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
      // In the business's booking queue, like every write of a time.
      booking = await inBookingQueue(business.id, (tx) =>
        tx.booking.create({
          data: {
            businessId:    business.id,
            serviceId,
            customerId:    customer.id,
            customerName,
            customerPhone,
            // Typed by the owner for this booking. Not read back from the
            // Customer record, which an anonymous booking may have filled.
            customerEmail: customerEmail || null,
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
        }),
      );
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
    notifyLater({ type: "booking.created", bookingId: booking.id, by: "business", actorUserId: session.user.id });
    await recordBusinessMilestone("FIRST_BOOKING", business.id);

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
    const busy = queueBusyResponse(e);
    if (busy) return busy;
    log.error("[bookings POST]", e);
    return err("حدث خطأ أثناء إنشاء الحجز", 500);
  }
}
