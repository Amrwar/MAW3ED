/**
 * POST /api/business/subscription/upgrade
 *
 * Initiates a Paymob payment session to upgrade the business subscription plan.
 * Body: { plan: "PRO" | "PREMIUM" }
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
import { PAID_PLANS } from "@/lib/plans";
import { createSubscriptionPaymentSession } from "@/lib/services/paymob";
import { attachProviderOrder, openPayment } from "@/lib/payments/ledger";
import { canPurchase, priceCentsFor } from "@/lib/payments/subscription";
import { log } from "@/lib/logger";

const upgradeSchema = z.object({
  // From the matrix, so a new paid tier is purchasable without this
  // route having to be told about it.
  plan: z.enum(PAID_PLANS),
});

export async function POST(req: Request) {
  try {
    const { session, business } = await requireBusiness();

    const body   = await req.json();
    const parsed = upgradeSchema.safeParse(body);
    if (!parsed.success) return err("خطة غير صالحة", 422);

    const { plan } = parsed.data;

    // Asked by rank, not by plan name. The old version compared
    // "PREMIUM" to "PRO" directly, which is a fact about the tier
    // order living outside the matrix that owns it.
    //
    // Renewing early is allowed now. It used to be refused more than a
    // week out because the webhook set the new period to now + 30 days
    // and threw away whatever was left; it extends from the existing
    // end instead, so paying early costs the owner nothing.
    const check = canPurchase({
      currentPlan: business.plan,
      targetPlan:  plan,
      status:      business.subscriptionStatus,
    });
    if (!check.ok) return err(check.reason ?? "لا يمكن تنفيذ هذه الترقية", 400);

    // Get owner info for billing
    const owner = await db.user.findUnique({
      where:  { id: session.user.id },
      select: { name: true, email: true },
    });

    const ownerName  = owner?.name ?? business.nameAr;
    const ownerPhone = business.phone ?? business.whatsapp ?? "01000000000";
    const amountCents = priceCentsFor(plan);

    // Opened before the owner leaves, so an abandoned upgrade is a
    // PENDING row naming the plan rather than nothing at all.
    const payment = await openPayment({
      kind:       "SUBSCRIPTION",
      businessId: business.id,
      plan,
      amountCents,
    });

    try {
      const { paymentUrl, paymobOrderId } = await createSubscriptionPaymentSession({
        businessId:  business.id,
        plan,
        amountCents,
        ownerName,
        ownerPhone,
        ownerEmail: owner?.email ?? undefined,
      });

      await attachProviderOrder(payment.id, paymobOrderId);

      // Still written: it is how anything older finds this payment.
      await db.business.update({
        where: { id: business.id },
        data:  {
          pendingPlan:               plan,
          subscriptionPaymobOrderId: paymobOrderId,
        },
      });

      return ok({ paymentUrl });
    } catch (sessionError) {
      await db.payment.update({
        where: { id: payment.id },
        data:  { status: "FAILED", failureReason: "could not open a Paymob session" },
      });
      throw sessionError;
    }

  } catch (e) {
    if (e instanceof Response) return e;
    log.error("[subscription upgrade]", e);
    return err("تعذّر بدء عملية الدفع، حاول مرة أخرى", 502);
  }
}
