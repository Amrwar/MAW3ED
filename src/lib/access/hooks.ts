import type { Prisma } from "@prisma/client";
import { after } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { syncBookingAccess } from "./passes";
import { kickAccessJobs } from "./sync";

/**
 * What a booking change means for its codes and passes. Called from the
 * one place statuses move (lib/bookings/state.ts applyMove, inside its
 * transaction) and after each reschedule.
 *
 * The check-in code needs nothing pushed — a scan reads the booking as
 * it is — but a booking that is over has its code withdrawn, so the
 * record says so. Visitor passes are re-decided (lib/access/passes.ts),
 * with any provider call queued in the same transaction.
 */

const OVER = new Set(["CANCELLED", "NO_SHOW", "COMPLETED", "FAILED_PAYMENT"]);

export async function accessAfterMove(tx: Prisma.TransactionClient, bookingId: string, to: string): Promise<void> {
  if (OVER.has(to)) {
    await tx.bookingCheckIn.updateMany({
      where: { bookingId, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date(), revokedReason: `booking ${to.toLowerCase()}` },
    });
  }
  const { queued } = await syncBookingAccess(bookingId, { tx });
  // Runs after the response, by when this transaction has committed; the
  // cron picks up anything it misses.
  if (queued) kickAccessJobs();
}

/** How many bookings one change re-decides at once; the cron reaches the rest. */
export const RESYNC_LIMIT = 200;

/**
 * Something passes depend on changed without a booking moving (a venue's
 * switch, policy or notices; a business's status): decide those bookings'
 * live passes again, after the response, RESYNC_LIMIT at most, with one
 * job run at the end rather than one per booking.
 */
export function resyncLiveAccess(where: Prisma.AccessEntitlementWhereInput): void {
  const run = async () => {
    let live: { bookingId: string }[];
    try {
      live = await db.accessEntitlement.findMany({
        where: { ...where, status: { in: ["ELIGIBLE", "SUSPENDED"] }, validUntil: { gt: new Date() } },
        select: { bookingId: true },
        distinct: ["bookingId"],
        take: RESYNC_LIMIT,
      });
    } catch (e) {
      log.error("[access] could not list passes to decide again; the cron will", e);
      return;
    }
    let queued = false;
    for (const { bookingId } of live) {
      try {
        queued = (await syncBookingAccess(bookingId, { kick: false })).queued || queued;
      } catch (e) {
        log.error("[access] resync failed for a booking", e, { bookingId });
      }
    }
    if (queued) kickAccessJobs();
  };
  try {
    after(run);
  } catch {
    void run();
  }
}

/** A business's status changed (suspended, closed, reopened): its passes follow. */
export function accessAfterBusinessChange(businessId: string): void {
  resyncLiveAccess({ bookingGuest: { booking: { businessId } } });
}

/** After a booking's time moved (its own transaction; never fails the move). */
export async function accessAfterReschedule(bookingId: string): Promise<void> {
  try {
    await syncBookingAccess(bookingId);
  } catch (e) {
    log.error("[access] could not update passes after a reschedule; the cron will", e, { bookingId });
  }
}
