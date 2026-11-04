import type { Payment, PaymentMethod, Prisma } from "@prisma/client";
import { settlePayment } from "@/lib/payments/ledger";
import { purchasePeriodEnd, renewalPeriodEnd } from "@/lib/payments/subscription";
import type { Plan } from "@/lib/plans";
import { log } from "@/lib/logger";
import { notifyLater } from "@/lib/notifications";
import { recordBusinessMilestone } from "@/lib/business/lifecycle";

/**
 * A plan payment has landed: activate the plan. Shared by every provider's
 * webhook (Paymob, Stripe), so a plan bought either way is extended,
 * rewarded and announced by the same code — moved here unchanged from the
 * Paymob webhook.
 *
 * Settles once (settlePayment): a replay returns "already-settled" and
 * changes nothing.
 */
export async function activateSubscription(
  payment: Payment,
  transactionId: string,
  method: PaymentMethod | null,
  provider: "paymob" | "stripe",
): Promise<string> {
  const plan = payment.plan as Plan | null;
  if (!plan || plan === "FREE") {
    log.warn(`${provider} webhook: subscription payment with no plan`, { paymentId: payment.id });
    return "subscription-without-plan";
  }

  // A holder, because control-flow analysis cannot see that the
  // settle callback runs before this is read.
  const period: { until: Date | null } = { until: null };

  const { changed } = await settlePayment({
    paymentId: payment.id,
    providerTransactionId: transactionId,
    method,
    onFirstSettle: async (tx, settled) => {
      const business = await tx.business.findUniqueOrThrow({
        where: { id: settled.businessId },
        select: { plan: true, currentPeriodEnd: true, referredById: true, referralRewardedAt: true },
      });

      // Extends from whatever is left, not from today — renewing early
      // used to forfeit the remaining days, which is why the upgrade
      // route had to refuse renewals more than a week out. Days left on
      // a cheaper plan are converted at the price difference first, and
      // a payment that bought a year (periodMonths 12) adds a year.
      period.until = purchasePeriodEnd({
        currentPlan: business.plan as Plan,
        currentEnd: business.currentPeriodEnd,
        newPlan: plan,
        months: settled.periodMonths,
      });

      await tx.business.update({
        where: { id: settled.businessId },
        data: {
          plan,
          subscriptionStatus: "ACTIVE",
          currentPeriodEnd: period.until,
          pendingPlan: null,
          subscriptionPaymobOrderId: null,
          subscriptionReminderSentAt: null,
        },
      });

      await rewardReferrer(tx, settled.businessId, business);
    },
  });

  if (!changed) return "already-settled";

  await recordBusinessMilestone("FIRST_PAID_SUBSCRIPTION", payment.businessId);

  log.info(`[${provider} webhook] subscription activated`, {
    businessId: payment.businessId,
    plan,
    until: period.until?.toISOString(),
  });

  if (period.until) {
    notifyLater({
      type: "subscription.renewed",
      businessId: payment.businessId,
      until: period.until,
    });
  }

  return "subscription-settled";
}

/**
 * A plan payment that failed or expired lets go of the pending plan, so the
 * owner can try again. Only the attempt this payment belongs to is cleared:
 * a newer attempt (another provider, another tab) stays live.
 */
export async function releasePendingPlan(
  tx: Prisma.TransactionClient,
  payment: Pick<Payment, "businessId" | "providerOrderId">,
): Promise<void> {
  await tx.business.updateMany({
    where: { id: payment.businessId, subscriptionPaymobOrderId: payment.providerOrderId },
    data: { pendingPlan: null, subscriptionPaymobOrderId: null },
  });
}

/**
 * A business whose referral finally paid gets the referrer 30 days.
 *
 * Inside the settlement transaction, and guarded by referralRewardedAt,
 * so a replay cannot hand out the reward twice.
 */
async function rewardReferrer(
  tx: Prisma.TransactionClient,
  businessId: string,
  business: { referredById: string | null; referralRewardedAt: Date | null },
): Promise<void> {
  if (!business.referredById || business.referralRewardedAt) return;

  const referrer = await tx.business.findUnique({
    where: { id: business.referredById },
    select: { id: true, currentPeriodEnd: true },
  });
  if (!referrer) return;

  await tx.business.update({
    where: { id: referrer.id },
    data: { currentPeriodEnd: renewalPeriodEnd(referrer.currentPeriodEnd) },
  });
  await tx.business.update({
    where: { id: businessId },
    data: { referralRewardedAt: new Date() },
  });

  log.info("[referral reward] 30 days added", { referrerId: referrer.id });
}
