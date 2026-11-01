import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * One booking write at a time per business, for every write that puts a
 * time into the overlap constraints: a new booking, a manual one, a
 * moved one, a released one revived.
 *
 * Two simultaneous writes for the same time each add their row to both
 * constraints and then wait on the other's unfinished row: a deadlock
 * Postgres takes a second to break. Under a burst at one business that
 * became a minute of storm, and customers told "taken" with tables still
 * free. Queued, each write takes milliseconds and the constraint still
 * decides who wins.
 *
 * Held until the transaction ends. Taken first, so the statements after
 * it — at Read Committed — see everything committed ahead in the queue,
 * which is what keeps the monthly count in createBooking exact.
 */
export async function takeBookingQueue(tx: Prisma.TransactionClient, businessId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-write:${businessId}`}, 0))`;
}

/** Runs a single booking write in its own transaction, in the business's queue. */
export function inBookingQueue<T>(businessId: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await takeBookingQueue(tx, businessId);
      return write(tx);
    },
    // As in createBooking: a burst waits for the pool rather than failing.
    { maxWait: 10_000, timeout: 20_000 },
  );
}
