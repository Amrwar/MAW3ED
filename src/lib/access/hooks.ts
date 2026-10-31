import type { Prisma } from "@prisma/client";
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

/** After a booking's time moved (its own transaction; never fails the move). */
export async function accessAfterReschedule(bookingId: string): Promise<void> {
  try {
    await syncBookingAccess(bookingId);
  } catch (e) {
    log.error("[access] could not update passes after a reschedule; the cron will", e, { bookingId });
  }
}
