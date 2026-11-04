import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { requireBusinessAccess } from "@/lib/business-access";
import { businessHandle, readJson } from "@/lib/business/route";
import { dialable } from "@/lib/phone";
import { createSeries } from "@/lib/bookings/series";
import { notifyLater } from "@/lib/notifications";

/**
 * Recurring appointments, made at the desk (lib/bookings/series.ts).
 * GET: the business's series. POST: make one — each occurrence through
 * the engine; the answer lists what was made and what was skipped, and why.
 */
const body = z.object({
  serviceId: z.string().min(1).max(40),
  customerName: z.string().trim().min(2).max(120),
  customerPhone: z.string().min(5).max(40).refine((v) => dialable(v) !== null, "رقم الهاتف غير صحيح"),
  customerEmail: z.string().email().optional().or(z.literal("")),
  staffMemberId: z.string().max(40).optional(),
  resourceId: z.string().max(40).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  intervalWeeks: z.number().int().min(1).max(4),
  occurrences: z.number().int().min(2).max(12),
  notes: z.string().max(500).optional(),
});

export async function GET() {
  return businessHandle("series GET", async () => {
    const { business } = await requireBusinessAccess("bookings.create");
    const rows = await db.bookingSeries.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, customerName: true, customerPhone: true, intervalWeeks: true, occurrences: true,
        startDate: true, startTime: true, status: true, serviceId: true, createdAt: true,
        bookings: { select: { id: true, date: true, status: true, seriesIndex: true }, orderBy: { seriesIndex: "asc" } },
      },
    });
    return ok({ series: rows });
  });
}

export async function POST(req: Request) {
  return businessHandle("series POST", async () => {
    const { session, business, actor } = await requireBusinessAccess("bookings.create");
    if (actor.role === "DELEGATE" && actor.delegation?.branchIds) {
      return err("الإدارة المفوّضة على فرع واحد مش بتضيف حجوزات يدوي", 403, { code: "forbidden" });
    }
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return err(parsed.error.issues[0].message, 422, { code: "invalid" });
    const d = parsed.data;
    if (d.staffMemberId && !(await db.staffMember.count({ where: { id: d.staffMemberId, businessId: business.id } }))) {
      return err("الموظف غير موجود", 404);
    }
    if (d.resourceId && !(await db.resource.count({ where: { id: d.resourceId, businessId: business.id } }))) {
      return err("المكان غير موجود", 404);
    }
    const customer = await db.customer.upsert({
      where: { businessId_phone: { businessId: business.id, phone: d.customerPhone } },
      create: { businessId: business.id, name: d.customerName, phone: d.customerPhone },
      update: {},
      select: { id: true },
    });
    const r = await createSeries({
      businessId: business.id,
      serviceId: d.serviceId,
      customerId: customer.id,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      customerEmail: d.customerEmail || null,
      staffMemberId: d.staffMemberId ?? null,
      resourceId: d.resourceId ?? null,
      startDate: d.startDate,
      startTime: d.startTime,
      intervalWeeks: d.intervalWeeks,
      occurrences: d.occurrences,
      createdById: session.user.id,
      notes: d.notes ?? null,
    });
    if ("error" in r) return err(r.error === "bounds" ? "التكرار من أسبوع لـ 4، ومن مرتين لـ 12 مرة" : "الخدمة غير موجودة", 422, { code: r.error });
    // One confirmation for the first occurrence; the rest are listed on it
    // and on the customer's account.
    if (r.made[0]) notifyLater({ type: "booking.created", bookingId: r.made[0].bookingId, by: "business", actorUserId: session.user.id });
    return ok(r, 201);
  });
}
