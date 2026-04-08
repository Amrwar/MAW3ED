/**
 * POST /api/business/subscription/upgrade
 *
 * Initiates a Paymob payment session to upgrade the business subscription plan.
 * Body: { plan: "GROWTH" | "PRO" }
 *
 * Flow:
 *  1. Validate the requested plan
 *  2. Create a Paymob payment session for the monthly subscription fee
 *  3. Store pendingPlan + subscriptionPaymobOrderId on the business
 *  4. Return { paymentUrl } — client redirects there
 *
 * The webhook at /api/webhooks/paymob activates the plan after payment.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { ok, err, requireBusiness } from "@/lib/api";
import { PLAN_PRICES_CENTS } from "@/lib/plans";
import { createSubscriptionPaymentSession } from "@/lib/services/paymob";

const upgradeSchema = z.object({
  plan: z.enum(["GROWTH", "PRO"]),
});

export async function POST(req: Request) {
  try {
    const { session, business } = await requireBusiness();

    const body   = await req.json();
    const parsed = upgradeSchema.safeParse(body);
    if (!parsed.success) return err("خطة غير صالحة", 422);

    const { plan } = parsed.data;

    // Don't allow downgrade via this endpoint
    if (business.plan === "PRO" && plan === "GROWTH") {
      return err("لا يمكن الرجوع لخطة أقل من هنا", 400);
    }

    // Don't re-pay for the same active plan
    if (business.plan === plan && business.subscriptionStatus === "ACTIVE") {
      return err("أنت مشترك بالفعل في هذه الخطة", 400);
    }

    // Get owner info for billing
    const owner = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, email: true },
    });

    const ownerName  = owner?.name ?? business.nameAr;
    const ownerPhone = business.phone ?? business.whatsapp ?? "01000000000";
    const amountCents = PLAN_PRICES_CENTS[plan];

    const { paymentUrl, paymobOrderId } = await createSubscriptionPaymentSession({
      businessId:  business.id,
      plan,
      amountCents,
      ownerName,
      ownerPhone,
      ownerEmail: owner?.email ?? undefined,
    });

    // Store pending plan and Paymob order ID for webhook correlation
    await db.business.update({
      where: { id: business.id },
      data:  {
        pendingPlan:               plan,
        subscriptionPaymobOrderId: paymobOrderId,
      },
    });

    return ok({ paymentUrl });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[subscription upgrade]", e);
    return err("تعذّر بدء عملية الدفع، حاول مرة أخرى", 502);
  }
}
