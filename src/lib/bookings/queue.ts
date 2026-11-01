import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * One booking write at a time per business, for the writes that put a
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

/** One transaction in the business's queue; createBooking retries around it itself. */
export function queuedTransaction<T>(businessId: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return db.$transaction(
    async (tx) => {
      await takeBookingQueue(tx, businessId);
      return write(tx);
    },
    {
      // Read Committed, so each statement sees what the writes queued
      // ahead of it committed. At Serializable the snapshot is taken
      // before the lock is granted, and every queued insert at a
      // business with a monthly limit failed and retried on it.
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      // A burst at one business queues for the connection pool too.
      // Each write holds a connection for milliseconds, but Prisma's
      // default gives a transaction two seconds to *start*, and under
      // fifty simultaneous requests the ones at the back were failing
      // with "unable to start a transaction". They wait now.
      maxWait: 10_000,
      timeout: 20_000,
    },
  );
}

const START_ATTEMPTS = 4;

/**
 * A single booking write in the business's queue. A transaction that
 * never began — no connection within the wait — wrote nothing, so it is
 * tried again after a short, jittered pause, as createBooking does.
 */
export async function inBookingQueue<T>(businessId: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await queuedTransaction(businessId, write);
    } catch (e) {
      if (!isTransactionStartTimeout(e) || attempt >= START_ATTEMPTS) throw e;
      await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));
    }
  }
}

/** Prisma P2028: the interactive transaction could not be started in time. */
export function isTransactionStartTimeout(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2028" &&
    /start a transaction/i.test(e.message)
  );
}
