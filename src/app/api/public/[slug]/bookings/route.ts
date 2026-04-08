import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { bookingSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
import { bookingPageUrl } from "@/lib/url";
import { hasBookingConflict, timeToMinutes, minutesToTime } from "@/lib/bookings/overlap";
import {
  sendBusinessBookingTemplate,
  sendCustomerConfirmationTemplate,
} from "@/lib/services/whatsapp";
import type { BookingNotificationData } from "@/lib/services/whatsapp-messages";
import {
  sendBookingConfirmationToCustomer,
  sendNewBookingAlertToBusiness,
  type BookingEmailData,
} from "@/lib/services/email";
import { createPaymentSession, calcDepositCents } from "@/lib/services/paymob";

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

    const { serviceId, date, startTime, customerName, customerPhone, customerEmail, notes } = parsed.data;

    const business = await db.business.findUnique({
      where:   { slug, isPublished: true },
      include: { owner: { select: { email: true } } },
    });
    if (!business) return err("لم يتم العثور على هذا العمل", 404);

    const service = await db.service.findFirst({
      where: { id: serviceId, businessId: business.id, isAvailable: true },
    });
    if (!service) return err("الخدمة غير موجودة", 404);

    // Parse date as UTC midnight — must match how slots API stores/queries
    const [year, month, day] = date.split("-").map(Number);
    const dateUTC = new Date(Date.UTC(year, month - 1, day));

    // ── Calculate candidate time range ────────────────────────────────────────
    const candidateStart = timeToMinutes(startTime);
    const candidateEnd   = candidateStart + service.duration;
    const endTime        = minutesToTime(candidateEnd);

    // ── Overlap conflict check ─────────────────────────────────────────────────
    if (await hasBookingConflict(business.id, dateUTC, candidateStart, candidateEnd)) {
      return err("هذا الموعد محجوز بالفعل، اختر وقتًا آخر", 409);
    }

    // ── Upsert customer ────────────────────────────────────────────────────────
    const customer = await db.customer.upsert({
      where:  { businessId_phone: { businessId: business.id, phone: customerPhone } },
      create: { businessId: business.id, name: customerName, phone: customerPhone, email: customerEmail || null },
      update: { name: customerName, ...(customerEmail ? { email: customerEmail } : {}) },
    });

    // ── Determine initial status and deposit ──────────────────────────────────
    const requiresDeposit = business.depositEnabled;
    const depositCents    = requiresDeposit
      ? calcDepositCents(Number(service.price), business.depositPercent)
      : 0;
    const depositAmount   = requiresDeposit ? depositCents / 100 : null;
    const initialStatus   = requiresDeposit ? "PENDING_PAYMENT" : "PENDING";

    // ── Create booking ─────────────────────────────────────────────────────────
    const accessToken = randomBytes(32).toString("hex");
    const booking = await db.booking.create({
      data: {
        businessId:    business.id,
        serviceId:     service.id,
        customerId:    customer.id,
        customerName,
        customerPhone,
        date:          dateUTC,
        startTime,
        endTime,
        status:        initialStatus,
        totalPrice:    service.price,
        currency:      service.currency,
        notes:         notes ?? null,
        accessToken,
        depositAmount,
      },
    });

    // ── Build booking URL for customer self-service ───────────────────────────
    const bookingUrl = bookingPageUrl(accessToken);

    const bookingResponse = {
      id:           booking.id,
      accessToken:  booking.accessToken,
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
        console.error("[booking POST] Paymob session failed:", paymobError);
        return err("تعذّر بدء عملية الدفع، حاول مرة أخرى", 502);
      }
    }

    // ── No deposit: send notifications and return ─────────────────────────────
    const notifData: BookingNotificationData = {
      businessName:  business.nameAr,
      serviceName:   service.nameAr,
      date,
      startTime,
      endTime,
      customerName,
      customerPhone,
      totalPrice:    Number(service.price),
      currency:      service.currency,
      bookingUrl,
    };

    const businessPhone = business.whatsapp ?? business.phone;
    if (businessPhone) {
      void sendBusinessBookingTemplate(businessPhone, notifData);
    }
    void sendCustomerConfirmationTemplate(customerPhone, notifData);

    const emailData: BookingEmailData = {
      businessName:  business.nameAr,
      serviceName:   service.nameAr,
      date,
      startTime,
      endTime,
      customerName,
      customerPhone,
      totalPrice:    Number(service.price),
      currency:      service.currency,
      notes:         notes ?? null,
      bookingUrl,
    };

    if (business.owner.email) {
      void sendNewBookingAlertToBusiness(business.owner.email, emailData);
    }
    if (customerEmail) {
      void sendBookingConfirmationToCustomer(customerEmail, emailData);
    }

    return ok(
      {
        booking:         bookingResponse,
        requiresPayment: false,
      },
      201,
    );
  } catch (e) {
    console.error("[booking POST]", e);
    return err("حدث خطأ أثناء الحجز، حاول مرة أخرى", 500);
  }
}
