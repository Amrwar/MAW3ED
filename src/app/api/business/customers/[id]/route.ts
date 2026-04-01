import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/business/customers/[id]
 * Returns full customer profile with booking history (newest first).
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const customer = await db.customer.findFirst({
      where: { id, businessId: business.id },
      include: {
        bookings: {
          include: { service: { select: { nameAr: true, duration: true } } },
          orderBy: [{ date: "desc" }, { startTime: "desc" }],
        },
      },
    });

    if (!customer) return err("العميل غير موجود", 404);

    const activeBookings = customer.bookings.filter((b) => b.status !== "CANCELLED");
    const totalSpend     = customer.bookings
      .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
      .reduce((sum, b) => sum + Number(b.totalPrice), 0);
    const currency       = customer.bookings[0]?.currency ?? "EGP";
    const lastBooking    = activeBookings[0];

    return ok({
      id:              customer.id,
      name:            customer.name,
      phone:           customer.phone,
      email:           customer.email,
      notes:           customer.notes,
      createdAt:       customer.createdAt.toISOString(),
      bookingCount:    activeBookings.length,
      totalSpend,
      currency,
      lastBookingDate: lastBooking?.date.toISOString().split("T")[0] ?? null,
      bookings: customer.bookings.map((b) => ({
        id:          b.id,
        serviceName: b.service.nameAr,
        date:        b.date.toISOString().split("T")[0],
        startTime:   b.startTime,
        endTime:     b.endTime,
        status:      b.status,
        totalPrice:  Number(b.totalPrice),
        currency:    b.currency,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[customer GET]", e);
    return err("حدث خطأ", 500);
  }
}

const notesSchema = z.object({
  notes: z.string().max(1000, "الملاحظات طويلة جدًا").nullable(),
});

/**
 * PATCH /api/business/customers/[id]
 * Updates the customer's notes field.
 */
export async function PATCH(req: Request, { params }: Params) {
  try {
    const { business } = await requireBusiness();
    const { id } = await params;

    const body   = await req.json();
    const parsed = notesSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    // Verify ownership
    const existing = await db.customer.findFirst({
      where: { id, businessId: business.id },
    });
    if (!existing) return err("العميل غير موجود", 404);

    const updated = await db.customer.update({
      where: { id },
      data:  { notes: parsed.data.notes },
    });

    return ok({ id: updated.id, notes: updated.notes });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[customer PATCH]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}
