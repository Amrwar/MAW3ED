import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { dateToUTC } from "@/lib/bookings/instants";
import { timeToMinutes } from "@/lib/bookings/time";
import { log } from "@/lib/logger";

/**
 * Time the owner has closed off: breaks, holidays, vacations, one-off
 * closures.
 *
 * One endpoint for all four, because the availability engine treats
 * them identically — the kind only changes the label and the colour.
 */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const blockSchema = z
  .object({
    kind: z.enum(["BREAK", "HOLIDAY", "VACATION", "CLOSURE"]),
    /** Null means the whole business. */
    staffMemberId: z.string().min(1).nullable().optional(),
    branchId: z.string().min(1).nullable().optional(),
    /** Weekly form. */
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    /** Dated form, inclusive. */
    startsOn: z.string().regex(DATE).nullable().optional(),
    endsOn: z.string().regex(DATE).nullable().optional(),
    /** Both null means all day. */
    startTime: z.string().regex(HHMM).nullable().optional(),
    endTime: z.string().regex(HHMM).nullable().optional(),
    reason: z.string().trim().max(200).nullable().optional(),
  })
  .refine((v) => v.dayOfWeek !== null && v.dayOfWeek !== undefined ? true : !!v.startsOn, {
    message: "اختر يوم في الأسبوع أو تاريخ",
    path: ["startsOn"],
  })
  .refine(
    (v) => !(v.startTime && v.endTime) || timeToMinutes(v.endTime) > timeToMinutes(v.startTime),
    { message: "وقت النهاية لازم يكون بعد البداية", path: ["endTime"] },
  )
  .refine((v) => !(v.startsOn && v.endsOn) || v.endsOn >= v.startsOn, {
    message: "تاريخ النهاية لازم يكون بعد البداية",
    path: ["endsOn"],
  })
  // One without the other would describe half a window.
  .refine((v) => Boolean(v.startTime) === Boolean(v.endTime), {
    message: "أدخل وقت البداية والنهاية، أو سيبهم فاضيين لليوم كله",
    path: ["startTime"],
  });

export async function GET() {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const blocks = await db.timeBlock.findMany({
      where: { businessId: ctx.business.id },
      orderBy: [{ startsOn: "asc" }, { dayOfWeek: "asc" }],
      include: {
        staffMember: { select: { id: true, nameAr: true } },
        branch: { select: { id: true, nameAr: true } },
      },
    });

    return ok({ blocks });
  } catch (e) {
    log.error("[time-blocks GET]", e);
    return err("حدث خطأ", 500);
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const parsed = blockSchema.safeParse(await req.json());
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const v = parsed.data;

    // Both ids must belong to this business, or an owner could close
    // somebody else's calendar.
    if (v.staffMemberId) {
      const member = await db.staffMember.findFirst({
        where: { id: v.staffMemberId, businessId: ctx.business.id },
        select: { id: true },
      });
      if (!member) return err("الموظف غير موجود", 404);
    }
    if (v.branchId) {
      const branch = await db.branch.findFirst({
        where: { id: v.branchId, businessId: ctx.business.id },
        select: { id: true },
      });
      if (!branch) return err("الفرع غير موجود", 404);
    }

    const block = await db.timeBlock.create({
      data: {
        businessId: ctx.business.id,
        kind: v.kind,
        staffMemberId: v.staffMemberId ?? null,
        branchId: v.branchId ?? null,
        dayOfWeek: v.dayOfWeek ?? null,
        startsOn: v.startsOn ? dateToUTC(v.startsOn) : null,
        endsOn: v.endsOn ? dateToUTC(v.endsOn) : null,
        startTime: v.startTime ?? null,
        endTime: v.endTime ?? null,
        reason: v.reason ?? null,
      },
      include: {
        staffMember: { select: { id: true, nameAr: true } },
        branch: { select: { id: true, nameAr: true } },
      },
    });

    return ok({ block }, 201);
  } catch (e) {
    log.error("[time-blocks POST]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}

export async function DELETE(req: Request) {
  try {
    const ctx = await requireBusiness().catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return err("id مطلوب", 400);

    const owned = await db.timeBlock.findFirst({
      where: { id, businessId: ctx.business.id },
      select: { id: true },
    });
    if (!owned) return err("غير موجود", 404);

    // Nothing points at a time block, so it is a real delete. Removing
    // one re-opens the time; it does not touch a booking that was made
    // before it existed.
    await db.timeBlock.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (e) {
    log.error("[time-blocks DELETE]", e);
    return err("حدث خطأ أثناء الحذف", 500);
  }
}
