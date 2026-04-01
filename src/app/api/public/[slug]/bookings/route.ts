import { db } from "@/lib/db";
import { bookingSchema } from "@/lib/validations";
import { ok, err } from "@/lib/api";
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

type Params = { params: Promise<{ slug: string }> };

/**
 * POST /api/public/[slug]/bookings
 *
 * Creates a booking for a public business.
 * Handles customer upsert (by phone + businessId) and conflict prevention.
 * Fires WhatsApp notifications after creation (non-blocking).
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

    // ── Conflict check ────────────────────────────────────────────────────────
    const conflict = await db.booking.findFirst({
      where: {
        businessId: business.id,
        date:       dateUTC,
        startTime,
        status:     { in: ["PENDING", "CONFIRMED"] },
      },
    });
    if (conflict) return err("هذا الموعد محجوز بالفعل، اختر وقتًا آخر", 409);

    // ── Calculate end time ─────────────────────────────────────────────────────
    const [sh, sm] = startTime.split(":").map(Number);
    const endMinutes = sh * 60 + sm + service.duration;
    const endTime = [
      Math.floor(endMinutes / 60).toString().padStart(2, "0"),
      (endMinutes % 60).toString().padStart(2, "0"),
    ].join(":");

    // ── Upsert customer ────────────────────────────────────────────────────────
    const customer = await db.customer.upsert({
      where:  { businessId_phone: { businessId: business.id, phone: customerPhone } },
      create: { businessId: business.id, name: customerName, phone: customerPhone, email: customerEmail || null },
      update: { name: customerName, ...(customerEmail ? { email: customerEmail } : {}) },
    });

    // ── Create booking ─────────────────────────────────────────────────────────
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
        status:        "PENDING",
        totalPrice:    service.price,
        currency:      service.currency,
        notes:         notes ?? null,
      },
    });

    // ── WhatsApp notifications (fire-and-forget, never blocks response) ────────
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
    };

    // Notify business owner via template — prefer WhatsApp number, fall back to phone
    const businessPhone = business.whatsapp ?? business.phone;
    if (businessPhone) {
      void sendBusinessBookingTemplate(businessPhone, notifData);
    }

    // Confirm to customer via template
    void sendCustomerConfirmationTemplate(customerPhone, notifData);

    // ── Email notifications (fire-and-forget) ─────────────────────────────────
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
    };

    // Business owner alert (uses owner's account email)
    if (business.owner.email) {
      void sendNewBookingAlertToBusiness(business.owner.email, emailData);
    }

    // Customer confirmation — only if they provided an email
    if (customerEmail) {
      void sendBookingConfirmationToCustomer(customerEmail, emailData);
    }

    return ok(
      {
        booking: {
          id:           booking.id,
          businessName: business.nameAr,
          serviceName:  service.nameAr,
          date,
          startTime,
          endTime,
          customerName,
          totalPrice:   Number(service.price),
          currency:     service.currency,
          status:       booking.status,
        },
      },
      201,
    );
  } catch (e) {
    console.error("[booking POST]", e);
    return err("حدث خطأ أثناء الحجز، حاول مرة أخرى", 500);
  }
}
