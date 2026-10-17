import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Payments that were started and never finished.
 *
 * PaymentStatus has had an ABANDONED member since the ledger was
 * written — "never came back, and the session expired" — and nothing
 * ever assigned it. A customer who reaches the Paymob page and closes
 * the tab leaves a PENDING row behind, and nothing has ever cleaned one
 * up.
 *
 * Two things rot as a result, and both were visible in production:
 *
 *   A booking in PENDING_PAYMENT holds its slot. overlap.ts counts
 *   PENDING_PAYMENT among the statuses that block an appointment, which
 *   is right while the customer is paying and wrong forever after. An
 *   abandoned checkout takes that slot out of the calendar for good,
 *   and nobody can book it again.
 *
 *   A business mid-upgrade keeps pendingPlan set. The owner's billing
 *   screen goes on saying an upgrade is in progress for an attempt that
 *   ended weeks ago.
 *
 * So this closes them out. It is reconciliation, not judgement: it only
 * touches rows the provider has had every chance to tell us about and
 * has not.
 */

/**
 * How long after a payment is opened before silence means abandonment.
 *
 * The Paymob payment key is created with `expiration: 3600`, so an hour
 * after that the customer cannot complete it even if they wanted to.
 * Two hours leaves a wide margin for a late webhook — the cost of
 * waiting is a slot held slightly longer, while the cost of being hasty
 * is cancelling a booking somebody is in the middle of paying for.
 */
const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000;

export interface ReapResult {
  abandoned: number;
  bookingsReleased: number;
  plansReleased: number;
}

export async function reapAbandonedPayments(now = new Date()): Promise<ReapResult> {
  const cutoff = new Date(now.getTime() - ABANDON_AFTER_MS);

  const stale = await db.payment.findMany({
    where: { status: "PENDING", createdAt: { lt: cutoff } },
    select: {
      id: true,
      kind: true,
      bookingId: true,
      businessId: true,
      providerOrderId: true,
      createdAt: true,
    },
    // A ceiling so one bad night cannot turn into an unbounded job.
    take: 500,
  });

  const result: ReapResult = { abandoned: 0, bookingsReleased: 0, plansReleased: 0 };

  for (const payment of stale) {
    try {
      await db.$transaction(async (tx) => {
        // Re-read inside the transaction. A webhook may have landed
        // between the query above and here, and a payment that just
        // succeeded must not be abandoned on top of it.
        const current = await tx.payment.findUnique({
          where: { id: payment.id },
          select: { status: true },
        });
        if (current?.status !== "PENDING") return;

        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "ABANDONED", failureReason: "no response from provider; session expired" },
        });
        result.abandoned++;

        if (payment.kind === "SUBSCRIPTION") {
          // Only clear the attempt this payment belongs to. The owner
          // may have started a newer one since, and releasing that
          // would cancel an upgrade that is still live.
          const cleared = await tx.business.updateMany({
            where: {
              id: payment.businessId,
              subscriptionPaymobOrderId: payment.providerOrderId,
            },
            data: { pendingPlan: null, subscriptionPaymobOrderId: null },
          });
          result.plansReleased += cleared.count;
          return;
        }

        if (!payment.bookingId) return;

        // A newer payment for the same booking — a fresh page opened
        // after this one expired, or one already paid — means the
        // booking is not waiting on this one. Releasing it would free a
        // slot the customer may be paying for right now.
        const newer = await tx.payment.count({
          where: {
            bookingId: payment.bookingId,
            id: { not: payment.id },
            createdAt: { gt: payment.createdAt },
            status: { in: ["PENDING", "SUCCEEDED"] },
          },
        });
        if (newer > 0) return;

        // Only a booking still waiting on this payment. One that was
        // confirmed by other means, or already cancelled, is not ours
        // to touch.
        const released = await tx.booking.updateMany({
          where: { id: payment.bookingId, status: "PENDING_PAYMENT" },
          data: { status: "FAILED_PAYMENT" },
        });
        // FAILED_PAYMENT rather than CANCELLED: it is the same status a
        // declined payment produces, so there is one meaning for "the
        // money did not arrive", and overlap.ts does not count it —
        // which is what puts the slot back.
        result.bookingsReleased += released.count;
      });
    } catch (e) {
      // One stuck row must not stop the rest being cleaned up.
      log.error("[payments] could not reap payment", { paymentId: payment.id, error: String(e) });
    }
  }

  // ── Holds with no payment behind them at all ─────────────────
  //
  // The loop above finds a held booking through its PENDING payment. A
  // booking that reached PENDING_PAYMENT without one — the payment row
  // failed to open, or its only payment was failed by a mismatched
  // callback — was invisible to it and held its slot for good. Past the
  // same window, a hold that nothing is still paying for (no PENDING
  // payment) and nothing has paid (no SUCCEEDED one, which would need a
  // person to look at, not a release) is let go.
  const orphans = await db.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      createdAt: { lt: cutoff },
      payments: { none: { status: { in: ["PENDING", "SUCCEEDED"] } } },
    },
    select: { id: true },
    take: 500,
  });
  for (const b of orphans) {
    try {
      // Under the lock /pay takes before it opens a new payment, and
      // re-checked in the write: a payment being opened right now either
      // commits first (and this leaves the booking) or waits for this.
      const released = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${b.id}))`;
        return tx.booking.updateMany({
          where: {
            id: b.id,
            status: "PENDING_PAYMENT",
            payments: { none: { status: { in: ["PENDING", "SUCCEEDED"] } } },
          },
          data: { status: "FAILED_PAYMENT" },
        });
      });
      result.bookingsReleased += released.count;
    } catch (e) {
      log.error("[payments] could not release an orphaned hold", { bookingId: b.id, error: String(e) });
    }
  }

  // ── Upgrades with no payment behind them at all ──────────────
  //
  // The loop above reaps PENDING payment rows. It cannot see an upgrade
  // started before the ledger existed, when the order id was written
  // onto the business and no Payment row was created — and production
  // has one of those, an attempt whose order id matches nothing,
  // leaving the owner's billing screen claiming an upgrade is in
  // progress indefinitely.
  //
  // A lingering pendingPlan with no PENDING payment for its order is
  // stale by definition: a success clears it in handleSubscriptionSuccess
  // and a failure clears it in handleFailure, so the only way to still
  // be holding one is that neither ever arrived.
  const midUpgrade = await db.business.findMany({
    where: {
      pendingPlan: { not: null },
      subscriptionPaymobOrderId: { not: null },
      updatedAt: { lt: cutoff },
    },
    select: { id: true, subscriptionPaymobOrderId: true },
    take: 200,
  });

  for (const business of midUpgrade) {
    const live = await db.payment.findFirst({
      where: {
        providerOrderId: business.subscriptionPaymobOrderId,
        status: "PENDING",
      },
      select: { id: true },
    });
    // Still waiting on the provider; the loop above owns this one.
    if (live) continue;

    const cleared = await db.business.updateMany({
      // The order id is re-checked so a newer attempt started since the
      // query above is not cancelled out from under the owner.
      where: {
        id: business.id,
        subscriptionPaymobOrderId: business.subscriptionPaymobOrderId,
      },
      data: { pendingPlan: null, subscriptionPaymobOrderId: null },
    });
    result.plansReleased += cleared.count;
  }

  if (result.abandoned > 0 || result.plansReleased > 0 || result.bookingsReleased > 0) {
    log.info("[payments] abandoned payments reaped", {
      abandoned: result.abandoned,
      bookingsReleased: result.bookingsReleased,
      plansReleased: result.plansReleased,
    });
  }

  return result;
}
