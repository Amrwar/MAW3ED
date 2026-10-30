/**
 * PATCH /api/business/settings/deposit
 *
 * Update deposit settings for the authenticated business.
 * Body: { depositEnabled: boolean, depositPercent?: number (1–100) }
 *
 * 100 means the whole price is paid online when booking; the deposit
 * math (lib/payments/money.ts depositCents) accepts the same range.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { log } from "@/lib/logger";
import { businessAllows, cheapestPlanWith, type Plan, type SubscriptionStatus } from "@/lib/plans";

const depositSettingsSchema = z.object({
  depositEnabled: z.boolean(),
  depositPercent: z
    .number({ message: "نسبة العربون لازم تكون رقم من 1 لـ 100" })
    .int("نسبة العربون لازم تكون رقم صحيح من 1 لـ 100")
    .min(1, "نسبة العربون لازم تكون من 1 لـ 100")
    .max(100, "نسبة العربون لازم تكون من 1 لـ 100")
    .optional(),
});

export async function PATCH(req: Request) {
  try {
    const { business } = await requireBusiness();
    const body   = await req.json();
    const parsed = depositSettingsSchema.safeParse(body);
    if (!parsed.success) return err(parsed.error.issues[0].message, 422);

    const { depositEnabled, depositPercent } = parsed.data;

    // Turning deposits ON needs a plan that takes payments — the same
    // rule the booking route applies when it decides whether to charge.
    // Turning them off is always allowed, so a downgraded business can
    // tidy its settings.
    if (
      depositEnabled &&
      !businessAllows(
        {
          plan: business.plan as Plan,
          subscriptionStatus: business.subscriptionStatus as SubscriptionStatus,
          trialEndsAt: business.trialEndsAt,
        },
        "deposits",
      )
    ) {
      return err("العربون متاح في الباقات المدفوعة", 403, { code: "plan-required", upgradeTo: cheapestPlanWith("deposits") });
    }

    const updated = await db.business.update({
      where: { id: business.id },
      data:  {
        depositEnabled,
        ...(depositPercent !== undefined ? { depositPercent } : {}),
      },
      select: { depositEnabled: true, depositPercent: true },
    });

    return ok(updated);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[deposit settings PATCH]", e);
    return err("حدث خطأ أثناء حفظ الإعدادات", 500);
  }
}

/**
 * GET /api/business/settings/deposit
 * Returns current deposit settings for the authenticated business.
 */
export async function GET() {
  try {
    const { business } = await requireBusiness();

    const data = await db.business.findUnique({
      where:  { id: business.id },
      select: { depositEnabled: true, depositPercent: true },
    });

    return ok(data);
  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[deposit settings GET]", e);
    return err("حصلت مشكلة عندنا، جرّب تاني بعد شوية", 500);
  }
}
