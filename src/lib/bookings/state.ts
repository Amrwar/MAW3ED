import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { canTransition, releasesTime, type BookingStatusValue, type Mover } from "./transitions";
import { accessAfterMove } from "@/lib/access/hooks";
import { holdsBookingQueue, inBookingQueue } from "./queue";

/**
 * Moving a booking from one status to another, safely.
 *
 * The status writes used to be unconditional: `update({ data: { status
 * } })` from whatever the route had read a moment earlier. Two of them
 * racing — the owner cancelling while the deposit's webhook confirms,
 * the customer cancelling while the owner confirms, a reschedule
 * landing on a booking that was just cancelled — left whichever wrote
 * last, and the loser never knew (docs/audits/CRITICAL_FINDINGS.md,
 * P17-16).
 *
 * A move is now conditional on the status it was decided from: the
 * UPDATE names both, so of two concurrent moves exactly one matches a
 * row. The other gets `moved: false` and the caller says "this booking
 * changed, look again" instead of overwriting.
 *
 * Giving a time back carries its own duties, done in the same
 * transaction: a payment page still open for it is closed in the
 * ledger, a discount it redeemed is handed back, and money that already
 * landed is flagged for a person to refund.
 */

export interface MoveInput {
  bookingId: string;
  /** The status the decision was made from. */
  from: BookingStatusValue | string;
  to: BookingStatusValue;
  by: Mover;
  /** Extra columns to write with the move (a reschedule's new time, for instance). */
  data?: Prisma.BookingUpdateManyMutationInput;
  /** For the ledger note on an abandoned payment page. */
  reason?: string;
  /** Who at the business did it, for the audit trail. */
  actorUserId?: string | null;
}

export type MoveResult =
  | { moved: true; refundNeededCents: number }
  | { moved: false; why: "not-allowed" | "changed" };

type Tx = Prisma.TransactionClient;

export async function moveBooking(input: MoveInput, tx?: Tx): Promise<MoveResult> {
  if (!canTransition(input.from, input.to, input.by)) return { moved: false, why: "not-allowed" };
  // A move into a live status writes a new row version that the overlap
  // constraints check again, so it waits in the business's booking queue
  // (lib/bookings/queue.ts) like any write of a time. A move that ends
  // the booking leaves the constraints and needs no turn.
  // A caller passing its own transaction must run it in the queue when
  // the move is live (check-in does, through inBookingQueue).
  const live = !endsBooking(input.to);
  if (tx) {
    if (live) {
      const row = await tx.booking.findUnique({ where: { id: input.bookingId }, select: { businessId: true } });
      if (row && !holdsBookingQueue(row.businessId)) {
        throw new Error(`moveBooking to ${input.to} in a transaction outside the booking queue (lib/bookings/queue.ts)`);
      }
    }
    return applyMove(tx, input);
  }
  if (!live) return db.$transaction((t) => applyMove(t, input));
  const row = await db.booking.findUnique({ where: { id: input.bookingId }, select: { businessId: true } });
  if (!row) return { moved: false, why: "changed" };
  return inBookingQueue(row.businessId, (t) => applyMove(t, input));
}

const ENDING: readonly string[] = ["CANCELLED", "NO_SHOW", "COMPLETED", "FAILED_PAYMENT"];
const endsBooking = (to: string) => ENDING.includes(to);

async function applyMove(tx: Tx, input: MoveInput): Promise<MoveResult> {
  const { count } = await tx.booking.updateMany({
    where: { id: input.bookingId, status: input.from as BookingStatusValue },
    data: { ...(input.data ?? {}), status: input.to },
  });
  if (count === 0) return { moved: false, why: "changed" };

  // The first completed real booking is an onboarding milestone. Written
  // through this transaction, so it stands or falls with the move itself
  // and needs no second connection while this one is held.
  if (input.to === "COMPLETED") {
    const b = await tx.booking.findUnique({
      where: { id: input.bookingId },
      select: { isTest: true, businessId: true, business: { select: { ownerId: true } } },
    });
    if (b && !b.isTest) {
      await tx.lifecycleEvent.createMany({
        data: [{ userId: b.business.ownerId, businessId: b.businessId, kind: "FIRST_COMPLETED_BOOKING" }],
        skipDuplicates: true,
      });
    }
  }

  let refundNeededCents = 0;
  if (releasesTime(input.from, input.to)) {
    refundNeededCents = await releaseBookingHold(tx, {
      bookingId: input.bookingId,
      to: input.to,
      by: input.by,
      reason: input.reason,
      actorUserId: input.actorUserId ?? null,
    });
  }

  // The booking's check-in code and any visitor passes follow it, in this
  // same transaction (lib/access/hooks.ts).
  //
  // A move that ENDS the booking (cancelled, no-show, completed) must
  // withdraw its passes with it: if that fails, the move fails and is
  // retried, rather than leaving a pass opening a gate for a cancelled
  // booking. Any other move (a confirmation, an arrival) runs the access
  // step in a savepoint, so a failure there never stops the booking
  // moving; the cron issues or updates the pass later.
  if (endsBooking(input.to)) {
    await accessAfterMove(tx, input.bookingId, input.to);
  } else {
    await tx.$executeRaw`SAVEPOINT access_after_move`;
    try {
      await accessAfterMove(tx, input.bookingId, input.to);
      await tx.$executeRaw`RELEASE SAVEPOINT access_after_move`;
    } catch (e) {
      await tx.$executeRaw`ROLLBACK TO SAVEPOINT access_after_move`;
      log.error("[access] could not update passes after a booking move; the cron will", e, { bookingId: input.bookingId, to: input.to });
    }
  }
  return { moved: true, refundNeededCents };
}

/**
 * What giving a time back entails, beyond the status itself.
 *
 * Exported for the paths that release a hold without going through
 * moveBooking: the webhook's decline handling and the reaper, which
 * decide the status under their own locks. Returns the net money that
 * had already landed against the booking, in piastres — the amount a
 * person now has to refund — and writes an audit entry when it is
 * more than zero. Refunds are never issued from here: money leaving is
 * a super-admin action with a second pair of eyes (admin/payments).
 */
export async function releaseBookingHold(
  tx: Tx,
  p: { bookingId: string; to: BookingStatusValue; by: Mover; reason?: string; actorUserId?: string | null },
): Promise<number> {
  // A payment page the customer may still have open cannot be allowed
  // to take money for a time that is no longer held. The ledger says
  // so; if they pay through it anyway, the webhook records the money
  // and flags it (payment.unexpected_deposit) rather than reviving the
  // booking.
  await tx.payment.updateMany({
    where: { bookingId: p.bookingId, status: "PENDING", provider: "PAYMOB" },
    data: {
      status: "ABANDONED",
      failureReason: (p.reason ?? `booking ${p.to.toLowerCase()} by ${p.by}`).slice(0, 500),
    },
  });

  // The discount goes back on the shelf. The redemption row is removed
  // so the per-customer limit does not count a booking that never
  // happened, and the offer's count comes down — never below zero, in
  // case the row was written before counting existed.
  const redemption = await tx.discountRedemption.findUnique({
    where: { bookingId: p.bookingId },
    select: { id: true, discountId: true },
  });
  if (redemption) {
    await tx.discountRedemption.delete({ where: { id: redemption.id } });
    await tx.$executeRaw`
      UPDATE "Discount"
         SET "redemptionCount" = GREATEST(0, "redemptionCount" - 1), "updatedAt" = NOW()
       WHERE "id" = ${redemption.discountId}`;
  }

  // Money that arrived for a booking that is now off. Cancelling does
  // not refund by itself — whether it should is the business's policy
  // and a person's decision — but it must not be forgotten.
  const landed = await tx.payment.findMany({
    where: { bookingId: p.bookingId, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } },
    select: { amountCents: true, refundedCents: true },
  });
  const net = landed.reduce((sum, x) => sum + x.amountCents - Math.min(x.refundedCents, x.amountCents), 0);
  if (net > 0) {
    await tx.auditLog
      .create({
        data: {
          actorId: p.actorUserId ?? null,
          actorName: p.by === "customer" ? "Customer" : p.by === "system" ? "System" : "Business",
          actorRole: p.by,
          action: "booking.released_with_money",
          resourceType: "Booking",
          resourceId: p.bookingId,
          summary: `Booking moved to ${p.to} with ${(net / 100).toFixed(2)} already paid; decide on a refund (admin/payments).`,
          metadata: { netPaidCents: net, to: p.to, by: p.by },
        },
      })
      .catch((e) => log.error("[bookings] could not write refund-needed audit entry", e));
  }
  return net;
}
