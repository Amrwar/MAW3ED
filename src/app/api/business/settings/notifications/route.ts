/**
 * PATCH /api/business/settings/notifications
 *
 * What this business wants to be told about, and how long before an
 * appointment its customers should be reminded.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";

const schema = z.object({
  notifyByEmail: z.boolean().optional(),
  notifyByWhatsApp: z.boolean().optional(),
  notifyNewBooking: z.boolean().optional(),
  notifyCancellation: z.boolean().optional(),
  notifyPayment: z.boolean().optional(),
  // Empty string clears it back to the owner's email / the business's
  // own number, which is what null means here.
  notificationEmail: z.string().email().or(z.literal("")).nullable().optional(),
  notificationPhone: z.string().max(32).or(z.literal("")).nullable().optional(),

  reminderEnabled: z.boolean().optional(),
  /**
   * One hour to three days. The cron looks three days ahead, so a
   * longer lead would silently never fire — better to refuse it than
   * to accept a setting that does nothing.
   */
  reminderLeadHours: z.number().int().min(1).max(72).optional(),
  startingSoonEnabled: z.boolean().optional(),
  /** Fifteen minutes to twelve hours. */
  startingSoonLeadMins: z.number().int().min(15).max(720).optional(),
  reviewRequestEnabled: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const { business } = await requireBusiness();
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const d = parsed.data;
    const updated = await db.business.update({
      where: { id: business.id },
      data: {
        ...pick(d, [
          "notifyByEmail",
          "notifyByWhatsApp",
          "notifyNewBooking",
          "notifyCancellation",
          "notifyPayment",
          "reminderEnabled",
          "reminderLeadHours",
          "startingSoonEnabled",
          "startingSoonLeadMins",
          "reviewRequestEnabled",
        ]),
        ...(d.notificationEmail !== undefined
          ? { notificationEmail: d.notificationEmail || null }
          : {}),
        ...(d.notificationPhone !== undefined
          ? { notificationPhone: d.notificationPhone || null }
          : {}),
      },
      select: {
        notifyByEmail: true,
        notifyByWhatsApp: true,
        notifyNewBooking: true,
        notifyCancellation: true,
        notifyPayment: true,
        notificationEmail: true,
        notificationPhone: true,
        reminderEnabled: true,
        reminderLeadHours: true,
        startingSoonEnabled: true,
        startingSoonLeadMins: true,
        reviewRequestEnabled: true,
      },
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[notification settings PATCH]", e);
    return err("حدث خطأ أثناء حفظ الإعدادات", 500);
  }
}

/** Only the keys that were actually sent, so an absent one is left alone. */
function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}
