/**
 * GET   /api/business/settings/booking
 * PATCH /api/business/settings/booking
 *
 * The booking policies a business sets for itself:
 *
 *   autoConfirm               confirmed on the spot, or waits for the owner
 *   minNoticeMinutes          how soon a customer may book (0 = right away)
 *   maxAdvanceDays            how far ahead
 *   bufferMinutes             a gap after every appointment
 *   sameDayCutoff             "HH:MM" after which today closes, or null
 *   cancellationCutoffHours   how close to the start a customer may still
 *                             cancel or move it themselves
 *   accessDiscreet            keep the business's name off a venue's
 *                             security desk; null = the category's default
 *                             (GET also answers the default in force)
 *
 * Every field is optional on PATCH; only what is sent changes. A save
 * with `reviewed: true` — sent by the setup page's policies form, which
 * shows every policy at once — marks the policies as reviewed for the
 * setup checklist: the owner has seen them all and chosen, rather than
 * inheriting defaults they never knew existed. Flipping one switch
 * elsewhere does not count as reviewing the rest.
 *
 * Owner only: these are the business's word to its customers.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { DISCREET_SELECT, discreetByCategory } from "@/lib/access/discreet";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const bookingPolicySchema = z
  .object({
    autoConfirm: z.boolean(),
    minNoticeMinutes: z.number().int().min(0).max(7 * 24 * 60),
    maxAdvanceDays: z.number().int().min(1).max(365),
    bufferMinutes: z.number().int().min(0).max(240),
    sameDayCutoff: z.string().regex(HHMM, "وقت غير صحيح").nullable(),
    cancellationCutoffHours: z.number().int().min(0).max(168),
    accessDiscreet: z.boolean().nullable(),
    reviewed: z.literal(true),
  })
  .partial();

const SELECT = {
  autoConfirm: true,
  minNoticeMinutes: true,
  maxAdvanceDays: true,
  bufferMinutes: true,
  sameDayCutoff: true,
  cancellationCutoffHours: true,
  policiesReviewedAt: true,
  ...DISCREET_SELECT,
} as const;

/** The row as answered: the category is used only for the default in force. */
function shape({ category, policiesReviewedAt, ...row }: Awaited<ReturnType<typeof read>>) {
  return {
    ...row,
    policiesReviewedAt: policiesReviewedAt?.toISOString() ?? null,
    accessDiscreetDefault: discreetByCategory(category),
  };
}
function read(id: string) {
  return db.business.findUniqueOrThrow({ where: { id }, select: SELECT });
}

export async function GET() {
  try {
    const { business } = await requireBusiness();
    return ok(shape(await read(business.id)));
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[booking settings GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}

export async function PATCH(req: Request) {
  try {
    const { business } = await requireBusiness();
    const parsed = bookingPolicySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return err(parsed.error.issues[0]?.message ?? "قيمة غير صالحة", 422);

    const { reviewed, ...policies } = parsed.data;
    const updated = await db.business.update({
      where: { id: business.id },
      data: { ...policies, ...(reviewed ? { policiesReviewedAt: new Date() } : {}) },
      select: SELECT,
    });
    return ok(shape(updated));
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[booking settings PATCH]", e);
    return err("حدث خطأ أثناء حفظ الإعدادات", 500);
  }
}
