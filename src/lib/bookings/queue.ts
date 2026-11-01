import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * One booking write at a time per business, for the writes that put a
 * time into the overlap constraints or keep one there under a new row
 * version: a new booking, a manual one, a moved one, a released one
 * revived, and a move into a live status (confirmed, arrived, started).
 *
 * Two simultaneous writes for the same time each add their row to both
 * constraints and then wait on the other's unfinished row: a deadlock
 * Postgres takes a second to break. Under a burst at one business that
 * became a minute of storm, and customers told "taken" with tables still
 * free. Queued, each write takes milliseconds and the constraint still
 * decides who wins.
 *
 * Held until the transaction ends, and taken before any booking row is
 * locked, so it cannot form a cycle with a row lock. Taken first, the
 * statements after it — at Read Committed — see everything committed
 * ahead in the queue, which is what keeps the monthly count in
 * createBooking exact.
 */
export async function takeBookingQueue(tx: Prisma.TransactionClient, businessId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-write:${businessId}`}, 0))`;
}

/** The queue for a booking's business, inside a transaction the caller already holds. */
export async function takeBookingQueueFor(tx: Prisma.TransactionClient, bookingId: string): Promise<void> {
  const row = await tx.booking.findUnique({ where: { id: bookingId }, select: { businessId: true } });
  if (row) await takeBookingQueue(tx, row.businessId);
}

/*
 * Waiting in the queue used to hold a pooled connection: thirty
 * requests at one business could each take one, idle on the lock, and
 * leave every other business waiting for the pool. They now wait in
 * this process first, so a process holds at most one connection per
 * business for the queue; the database lock above still orders
 * processes against each other. The wait here does not count toward
 * the transaction's timeout either: the transaction begins at its turn.
 */
const lines = new Map<string, Promise<void>>();

async function inLine<T>(businessId: string, run: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const turn = new Promise<void>((r) => (release = r));
  const ahead = lines.get(businessId) ?? Promise.resolve();
  const tail = ahead.then(() => turn);
  lines.set(businessId, tail);
  await ahead;
  try {
    return await run();
  } finally {
    release();
    if (lines.get(businessId) === tail) lines.delete(businessId);
  }
}

/** One transaction in the business's queue; createBooking retries around it itself. */
export function queuedTransaction<T>(businessId: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return inLine(businessId, () =>
    db.$transaction(
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
        // Prisma's default gives a transaction two seconds to *start*;
        // under a burst across businesses the pool can take longer.
        maxWait: 10_000,
        timeout: 20_000,
      },
    ),
  );
}

const ATTEMPTS = 4;

/**
 * A single booking write in the business's queue. Tried again, after a
 * short jittered pause, when the transaction never began (no connection
 * within the wait) or was chosen to break a deadlock with a write that
 * does not take the queue: either way it was rolled back whole, so the
 * write simply runs again and meets the constraint afresh.
 */
export async function inBookingQueue<T>(businessId: string, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await queuedTransaction(businessId, write);
    } catch (e) {
      if (!(isTransactionStartTimeout(e) || isWriteConflict(e)) || attempt >= ATTEMPTS) throw e;
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

/** Prisma P2034: a write conflict or deadlock; the transaction was rolled back. */
function isWriteConflict(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034";
}
