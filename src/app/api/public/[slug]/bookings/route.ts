import { db } from "@/lib/db";
import { resolveAutomatic, resolveCode } from "@/lib/discounts/resolve";
import { FAILURE_AR } from "@/lib/discounts/apply";
import { toCents } from "@/lib/payments/money";
import { bookingSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import { createBooking } from "@/lib/bookings/create";
import { createPaymentSession } from "@/lib/services/paymob";
import { depositCents as calcDepositCents } from "@/lib/payments/money";
import { attachProviderOrder, openPayment } from "@/lib/payments/ledger";
import { getEffectivePlan, getMonthlyBookingLimit, canUseFeature, type Plan, type SubscriptionStatus } from "@/lib/plans";
import { log } from "@/lib/logger";
import { notify } from "@/lib/notifications";
import { callerKey, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { normalisePhone } from "@/lib/phone";

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
 *
 * Every refusal carries a `code` beside the Arabic `error` — slot-taken,
 * slot-unavailable (+ reason), limit-reached, discount-gone,
 * payment-unavailable and the rest — so the app can react to what
 * happened and say it in English as well, without parsing a sentence.
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const body   = await req.json();
    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return err(issue.message, 422, { code: "invalid", field: String(issue.path[0] ?? "") });
    }

    const { serviceId, date, startTime, customerName, customerPhone, customerEmail, notes,
            tableId, resourceId, staffMemberId, branchId, partySize, idempotencyKey,
            source, discountCode } = parsed.data;

    // ── Throttle ──────────────────────────────────────────────────────────────
    //
    // Anyone can call this, and every booking it creates holds a slot and
    // sends the owner an alert. A budget per address per business, checked
    // before any lookup so a flood never reaches the booking tables; the
    // limit, and why it is loose, is in lib/rate-limit.ts. The per-number
    // cap is below, once the business is known.
    const slugKey = slug.toLowerCase();
    const byAddress = await rateLimit("publicBooking", `${await callerKey()}|${slugKey}`);
    if (!byAddress.ok) return tooManyRequests(byAddress);

    const business = await db.business.findUnique({
      where:   { slug, isPublished: true },
      include: { owner: { select: { email: true } } },
      // include subscription fields for feature gating
    });
    if (!business) return err("لم يتم العثور على هذا العمل", 404, { code: "business-not-found" });

    // Per number, so rotating addresses does not let a script fill a day
    // under somebody else's phone. Counted from bookings actually made,
    // not attempts: a customer who gets "slot taken" five times at a busy
    // salon, or whose retry replays the same idempotency key, has booked
    // nothing and must not be locked out. Five in an hour under one
    // number at one business is more than any person makes.
    const phoneE164 = normalisePhone(customerPhone);
    if (phoneE164) {
      const isReplay = idempotencyKey
        ? (await db.booking.count({ where: { idempotencyKey } })) > 0
        : false;
      const recent = isReplay
        ? 0
        : await db.booking.count({
            where: {
              businessId: business.id,
              customerPhoneE164: phoneE164,
              createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
            },
          });
      if (recent >= 5) {
        return err("حجوزات كتير بالرقم ده في ساعة واحدة. جرّب بعد شوية.", 429, { code: "rate-limited" });
      }
    }

    const service = await db.service.findFirst({
      where: { id: serviceId, businessId: business.id, isAvailable: true },
    });
    if (!service) return err("الخدمة غير موجودة", 404, { code: "service-not-found" });

    // ── Find or create the customer ───────────────────────────────────────────
    //
    // The record belongs to the business: it is the name the owner has on
    // file, possibly corrected by hand. This request is anonymous — anyone
    // can type a known customer's phone number — so it may introduce a
    // customer but never rename one or redirect their email. It only
    // fills an email the record does not have yet. The booking itself
    // still carries the name the visitor typed, which is what the owner
    // sees against that appointment.
    const customer = await db.customer.upsert({
      where:  { businessId_phone: { businessId: business.id, phone: customerPhone } },
      create: { businessId: business.id, name: customerName, phone: customerPhone, email: customerEmail || null },
      update: {},
    });
    if (customerEmail && !customer.email) {
      // Conditional, so two concurrent bookings cannot both "fill" it and
      // leave whichever wrote last.
      await db.customer.updateMany({
        where: { id: customer.id, email: null },
        data:  { email: customerEmail },
      });
    }

    // ── Resolve effective plan ────────────────────────────────────────────────
    const effectivePlan = getEffectivePlan(
      business.plan as Plan,
      business.subscriptionStatus as SubscriptionStatus,
      business.trialEndsAt,
    );

    // ── Price, after anything that reduces it ─────────────────────────────────
    //
    // Worked out here and never taken from the request. The browser may
    // send a code; it may not send a price. What the customer was
    // quoted is re-derived from the same rules that produced the quote,
    // so a tampered payload gets the honest number rather than its own.
    const subtotalCents = toCents(service.price);

    const resolved = discountCode
      ? await resolveCode({
          businessId: business.id,
          serviceId: service.id,
          subtotalCents,
          code: discountCode,
          customerId: customer.id,
        })
      : await resolveAutomatic({
          businessId: business.id,
          serviceId: service.id,
          subtotalCents,
          customerId: customer.id,
        });

    // A code the customer typed and got wrong is worth saying out loud.
    // A promotion that happens not to apply is not: nobody asked.
    if (discountCode && resolved.ok === false) {
      return err(
        resolved.reason === "not-found" ? "الكود ده مش موجود" : FAILURE_AR[resolved.reason],
        422,
        { code: "discount-invalid", reason: resolved.reason },
      );
    }

    const applied = resolved.ok === true ? resolved.discount : null;
    const totalCents = applied ? applied.totalCents : subtotalCents;

    // ── Determine initial status and deposit ──────────────────────────────────
    // Deposits require a plan that includes them, and are a share of
    // what is actually owed — a deposit computed on the pre-discount
    // price would collect more than the booking costs.
    const requiresDeposit = business.depositEnabled && canUseFeature(effectivePlan, "deposits");
    const depositCents    = requiresDeposit
      ? calcDepositCents(totalCents / 100, business.depositPercent)
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
      // Already reduced: it is what the customer owes, so every
      // deposit, balance and payment calculation downstream reads it
      // without needing to know a discount happened.
      totalPrice:     totalCents / 100,
      currency:       service.currency,
      depositAmount,
      source:         source ?? null,
      discount:       applied ? { id: applied.id, amountCents: applied.amountCents } : null,
      idempotencyKey: idempotencyKey ?? null,
      monthlyLimit:   getMonthlyBookingLimit(effectivePlan),
    });

    if (!result.ok) {
      switch (result.failure.kind) {
        case "slot-taken":
          return err("حد تاني حجز الموعد ده دلوقتي، اختر وقت تاني", 409, { code: "slot-taken" });
        case "slot-unavailable":
          return err(unavailableMessage(result.failure.reason), 409, {
            code: "slot-unavailable",
            reason: result.failure.reason,
          });
        case "limit-reached":
          return err("المكان ده مش بيستقبل حجوزات أونلاين دلوقتي. كلّمهم مباشرة عشان تحجز.", 429, { code: "limit-reached" });
        case "service-not-found":
          return err("الخدمة غير موجودة", 404, { code: "service-not-found" });
        case "discount-gone":
          // Somebody took the last one while this customer was filling
          // in their name. Better to say so than to quietly charge them
          // more than the price they were quoted.
          return err("العرض خلص دلوقتي، جرّب تحجز من غير كود", 409, { code: "discount-gone" });
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
      // What was stored, after any discount — not the list price. The
      // done screen showed the undiscounted figure as the total.
      totalPrice:   Number(booking.totalPrice),
      depositAmount,
      currency:     service.currency,
      status:       booking.status,
    };

    // ── If deposit required: initiate Paymob payment session ─────────────────
    if (requiresDeposit) {
      // The ledger row goes in before the customer leaves for Paymob.
      // If they close the tab there is a PENDING payment saying what
      // they were trying to pay and for what, rather than a booking
      // that just sits in PENDING_PAYMENT with nothing behind it.
      const payment = await openPayment({
        kind:        "BOOKING_DEPOSIT",
        businessId:  business.id,
        bookingId:   booking.id,
        amountCents: depositCents,
        currency:    service.currency,
      });

      try {
        const { paymentUrl, paymobOrderId } = await createPaymentSession({
          bookingId:     booking.id,
          amountCents:   depositCents,
          currency:      service.currency,
          customerName,
          customerPhone,
          customerEmail,
        });

        await attachProviderOrder(payment.id, paymobOrderId);

        // Still written: it is how anything older finds this payment.
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
        await db.payment.update({
          where: { id: payment.id },
          data:  { status: "FAILED", failureReason: "could not open a Paymob session" },
        });
        log.error("[booking POST] Paymob session failed:", paymobError);
        return err("تعذّر بدء عملية الدفع، حاول مرة أخرى", 502, { code: "payment-unavailable" });
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
    return err("حدث خطأ أثناء الحجز، حاول مرة أخرى", 500, { code: "server-error" });
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
      return "النشاط مقفول في اليوم ده (إجازة)";
    case "vacation":
      return "الموظف ده في إجازة";
    default:
      return "الموعد ده مش متاح، اختر وقت تاني";
  }
}
