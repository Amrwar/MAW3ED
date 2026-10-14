import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { can, requireBusinessAccess } from "@/lib/business-access";
import { z } from "zod";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/business/customers/[id]
 * Returns full customer profile with booking history (newest first).
 */
export async function GET(_req: Request, { params }: Params) {
  try {
    const { business, actor } = await requireBusinessAccess("customers.read");
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
      // Money is the owner's; a manager sees the visits, not the spend.
      totalSpend: can(actor, "reports.read") ? totalSpend : null,
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
    log.error("[customer GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

const patchSchema = z.object({
  notes: z.string().max(2000).nullable().optional(),
  /**
   * The whole list, not a delta. A tag is removed by sending the list
   * without it, which means two people editing at once cannot end up
   * with a tag nobody added.
   */
  tags: z.array(z.string().trim().min(1).max(30)).max(20).optional(),
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    // Verify ownership — a customer id from another business must not
    // be editable from here.
    const existing = await db.customer.findFirst({
      where:  { id, businessId: business.id },
      select: { id: true },
    });
    if (!existing) return err("العميل غير موجود", 404);

    const { notes, tags } = parsed.data;

    const updated = await db.customer.update({
      where: { id },
      data: {
        ...(notes !== undefined
          ? { notes, notesUpdatedAt: notes?.trim() ? new Date() : null }
          : {}),
        // Deduplicated and trimmed here rather than trusted from the
        // client, so the tag filter does not end up with two of the
        // same label that merely look alike.
        ...(tags !== undefined
          ? { tags: [...new Set(tags.map((t) => t.trim()).filter(Boolean))] }
          : {}),
      },
      select: { id: true, notes: true, tags: true, notesUpdatedAt: true },
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[customer PATCH]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}
