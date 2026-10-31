import { requireBusinessAccess } from "@/lib/business-access";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err } from "@/lib/api";
import { timeToMinutes } from "@/lib/bookings/time";
import { log } from "@/lib/logger";

type Params = { params: Promise<{ id: string }> };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * A staff member's own working hours, one row per weekday.
 *
 * Sent as the whole week in one request. Partial updates across seven
 * independent rows is a lot of round trips and a lot of ways to end up
 * half-saved; the owner edits a week and saves a week.
 *
 * A member with no rows falls back to the business hours, which is what
 * every record created before this existed does. Clearing the week
 * restores that fallback rather than making them unbookable.
 */
const hoursSchema = z.object({
  hours: z
    .array(
      z
        .object({
          dayOfWeek: z.number().int().min(0).max(6),
          startTime: z.string().regex(HHMM),
          endTime: z.string().regex(HHMM),
          isOff: z.boolean().default(false),
        })
        .refine((d) => d.isOff || timeToMinutes(d.endTime) > timeToMinutes(d.startTime), {
          message: "وقت النهاية لازم يكون بعد البداية",
        }),
    )
    .max(7),
});

export async function PUT(req: Request, { params }: Params) {
  try {
    // A person's own hours are part of their staff record.
    const ctx = await requireBusinessAccess("staff.manage").catch(() => null);
    if (!ctx) return err("غير مصرح", 401);

    const { id } = await params;
    const member = await db.staffMember.findFirst({
      where: { id, businessId: ctx.business.id },
      select: { id: true },
    });
    if (!member) return err("الموظف غير موجود", 404);

    const parsed = hoursSchema.safeParse(await req.json());
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    // A day sent twice would violate the unique index halfway through
    // and leave the week partly written.
    const days = parsed.data.hours.map((h) => h.dayOfWeek);
    if (new Set(days).size !== days.length) return err("يوم مكرر", 422);

    // Replace the week in one transaction: no window where the member
    // has half their old hours and half their new ones.
    await db.$transaction([
      db.staffHours.deleteMany({ where: { staffMemberId: id } }),
      ...(parsed.data.hours.length > 0
        ? [
            db.staffHours.createMany({
              data: parsed.data.hours.map((h) => ({
                staffMemberId: id,
                dayOfWeek: h.dayOfWeek,
                startTime: h.startTime,
                endTime: h.endTime,
                isOff: h.isOff,
              })),
            }),
          ]
        : []),
    ]);

    const hours = await db.staffHours.findMany({
      where: { staffMemberId: id },
      orderBy: { dayOfWeek: "asc" },
    });

    return ok({ hours });
  } catch (e) {
    log.error("[staff hours PUT]", e);
    return err("حدث خطأ أثناء الحفظ", 500);
  }
}
