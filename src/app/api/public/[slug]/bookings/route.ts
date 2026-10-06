import { db } from "@/lib/db";
import { bookingSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import { createBooking } from "@/lib/bookings/create";
import { createPaymentSession, calcDepositCents } from "@/lib/services/paymob";
import { getEffectivePlan, getMonthlyBookingLimit, canUseFeature, type Plan, type SubscriptionStatus } from "@/lib/plans";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/public/[slug]/bookings
 *
 * Creates a booking for a public business.
 * If the business has depositEnabled, creates a PENDING_PAYMENT booking and
 * initiates a Paymob payment session — the response includes paymentUrl.
 * Otherwise creates a PENDING booking (existing manual-confirm flow).
 *
 * No auth required — public endpoint.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const body   = await req.json();
    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { serviceId, date, startTime, customerName, customerPhone, customerEmail, notes,
            tableId, resourceId, staffMemberId, branchId, partySize, idempotencyKey } = parsed.data;

    const business = await db.business.findUnique({
      where:   { slug, isPublished: true },
      include: { owner: { select: { email: true } } },
      // include subscription fields for feature gating
    });
    if (!business) return err("لم يتم العثور على هذا العمل", 404);

    const service = await db.service.findFirst({
      where: { id: serviceId, businessId: business.id, isAvailable: true },
    });
    if (!service) return err("الخدمة غير موجودة", 404);

    // ── Upsert customer ────────────────────────────────────────────────────────
    const customer = await db.customer.upsert({
      where:  { businessId_phone: { businessId: business.id, phone: customerPhone } },
      create: { businessId: business.id, name: customerName, phone: customerPhone, email: customerEmail || null },
      update: { name: customerName, ...(customerEmail ? { email: customerEmail } : {}) },
    });

    // ── Resolve effective plan ────────────────────────────────────────────────
    const effectivePlan = getEffectivePlan(
      business.plan as Plan,
      business.subscriptionStatus as SubscriptionStatus,
      business.trialEndsAt,
    );

    // ── Determine initial status and deposit ──────────────────────────────────
    // Deposits require a plan that includes them.
    const requiresDeposit = business.depositEnabled && canUseFeature(effectivePlan, "deposits");
    const depositCents    = requiresDeposit
      ? calcDepositCents(Number(service.price), business.depositPercent)
      : 0;
    const depositAmount   = requiresDeposit ? depositCents / 100 : null;

    // autoConfirm skips the owner's review step; without it the booking
    // waits for them, which is the behaviour every existing business has.
    const initialStatus: "PENDING" | "PENDING_PAYMENT" | "CONFIRMED" =
      requiresDeposit ? "PENDING_PAYMENT" : business.autoConfirm ? "CONFIRMED" : "PENDING";

    // ── Create ────────────────────────────────────────────────────────────────
    //
    // Everything that used to live here — the conflict check, the monthly
    // limit count, the insert — now happens inside one transaction in
    // lib/bookings/create.ts, with the slot re-derived server-side and an
    // exclusion constraint underneath. See the note at the top of that file.
    const result = await createBooking({
      businessId:     business.id,
      serviceId:      service.id,
      customerId:     customer.id,
      customerName,
      customerPhone,
      date,
      startTime,
      notes:          notes ?? null,
      staffMemberId:  staffMemberId ?? null,
      // The request still calls it tableId; a table is a resource.
      resourceId:     resourceId ?? tableId ?? null,
      branchId:       branchId ?? null,
      partySize:      partySize ?? null,
      status:         initialStatus,
      totalPrice:     service.price,
      currency:       service.currency,
      depositAmount,
      idempotencyKey: idempotencyKey ?? null,
      monthlyLimit:   getMonthlyBookingLimit(effectivePlan),
    });

    if (!result.ok) {
      switch (result.failure.kind) {
        case "slot-taken":
          return err("حد تاني حجز الموعد ده دلوقتي، اختر وقت تاني", 409);
        case "slot-unavailable":
          return err(unavailableMessage(result.failure.reason), 409);
        case "limit-reached":
          return err("عذرًا، هذا العمل بلغ الحد الأقصى من الحجوزات الشهرية", 429);
        case "service-not-found":
          return err("الخدمة غير موجودة", 404);
      }
    }

    const { booking, reused } = result;
    const endTime = booking.endTime ?? startTime;
    const accessToken = booking.accessToken!;

    // A retry that matched an earlier request returns the original
    // booking and sends nothing again — no second confirmation, no
    // second payment session.
    if (reused) {
      return ok(
        {
          booking: {
            id:           booking.id,
            reference:    booking.reference,
            accessToken,
            businessName: business.nameAr,
            serviceName:  service.nameAr,
            date,
            startTime:    booking.startTime,
            endTime,
            customerName: booking.customerName,
            totalPrice:   Number(booking.totalPrice),
            depositAmount: booking.depositAmount ? Number(booking.depositAmount) : null,
            currency:     booking.currency,
            status:       booking.status,
          },
          requiresPayment: booking.status === "PENDING_PAYMENT",
          idempotentReplay: true,
        },
        200,
      );
    }

    const bookingResponse = {
      id:           booking.id,
      reference:    booking.reference,
      accessToken,
      businessName: business.nameAr,
      serviceName:  service.nameAr,
      date,
      startTime,
      endTime,
      customerName,
      totalPrice:   Number(service.price),
      depositAmount,
      currency:     service.currency,
      status:       booking.status,
    };

    // ── If deposit required: initiate Paymob payment session ─────────────────
    if (requiresDeposit) {
      try {
        const { paymentUrl, paymobOrderId } = await createPaymentSession({
          bookingId:     booking.id,
          amountCents:   depositCents,
          currency:      service.currency,
          customerName,
          customerPhone,
          customerEmail,
        });

        // Store Paymob order ID for webhook correlation
        await db.booking.update({
          where: { id: booking.id },
          data:  { paymobOrderId },
        });

        // No notifications yet — send after payment confirmed via webhook
        return ok(
          {
            booking:         bookingResponse,
            requiresPayment: true,
            paymentUrl,
          },
          201,
        );
      } catch (paymobError) {
        // Paymob session creation failed — cancel the PENDING_PAYMENT booking
        // so the slot is freed, then return an error
        await db.booking.update({
          where: { id: booking.id },
          data:  { status: "FAILED_PAYMENT" },
        });
        log.error("[booking POST] Paymob session failed:", paymobError);
        return err("تعذّر بدء عملية الدفع، حاول مرة أخرى", 502);
      }
    }

    // ── No deposit: tell everybody, and return ────────────────────────────────
    // One call. Who hears about it, on which channels, and whether the
    // plan includes WhatsApp are all decided in lib/notifications —
    // including the in-app copy the customer's account shows, which
    // this route never used to file.
    void notify({ type: "booking.created", bookingId: booking.id });

    return ok(
      {
        booking:         bookingResponse,
        requiresPayment: false,
      },
      201,
    );
  } catch (e) {
    log.error("[booking POST]", e);
    return err("حدث خطأ أثناء الحجز، حاول مرة أخرى", 500);
  }
}

/** Why the server turned a slot down, in words a customer can act on. */
function unavailableMessage(reason: string | null): string {
  switch (reason) {
    case "past":
      return "الوقت ده عدّى خلاص";
    case "too-far-ahead":
      return "الحجز مش مفتوح للتاريخ ده لسه";
    case "same-day-cutoff":
      return "قفل الحجز لليوم، جرّب بكرة";
    case "business-closed":
      return "النشاط مقفول في الوقت ده";
    case "staff-off":
      return "الموظف ده مش متاح في الوقت ده";
    case "holiday":
      return "النشاط مقفول في اليوم ده (أجازة)";
    case "vacation":
      return "الموظف ده في أجازة";
    default:
      return "الموعد ده مش متاح، اختر وقت تاني";
  }
}
