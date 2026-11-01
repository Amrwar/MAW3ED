import { AsyncLocalStorage } from "node:async_hooks";
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
 * locked, so it cannot form a cycle with a row lock. (The Paymob
 * confirm of a booking awaiting payment does not take it: that runs in
 * the payment's settlement, which must not wait on anything, and the
 * booking keeps the time it already holds.) Taken first, the
 * statements after it — at Read Committed — see everything committed
 * ahead in the queue, which is what keeps the monthly count in
 * createBooking exact.
 */
export async function takeBookingQueue(tx: Prisma.TransactionClient, businessId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`booking-write:${businessId}`}, 0))`;
}

/*
 * Waiting in the queue used to hold a pooled connection: thirty
 * requests at one business could each take one, idle on the lock, and
 * leave every other business waiting for the pool. They now wait in
 * this process first, so a process holds at most one connection per
 * business for the queue; the database lock above still orders
 * processes against each other. The wait here does not count toward
 * the transaction's timeout either: the transaction begins at its turn.
 *
 * The wait is bounded like the pool's: a request that has not reached
 * its turn in WAIT_MS gives up before doing anything, and it never runs
 * later, after its caller was told it failed. It fails as
 * BookingQueueBusy — Prisma's P2028, so the public route answers "busy,
 * try again" (503), and the other routes say the same. It is not retried
 * by default: the line is genuinely backed up, and joining its end again
 * would only make the wait longer. A write nobody will send again (a
 * webhook's) asks for a couple of retries.
 */
const lines = new Map<string, Promise<void>>();
/** How long a request waits for its turn, and then for a connection. */
const WAIT_MS = 10_000;

/** The turns the current async context holds; a turn ends when its write does. */
interface Held {
  readonly businessIds: ReadonlySet<string>;
  active: boolean;
}
const holding = new AsyncLocalStorage<Held>();

function heldNow(): Held | undefined {
  const held = holding.getStore();
  return held?.active ? held : undefined;
}

/** True inside a queued write for this business. */
export function holdsBookingQueue(businessId: string): boolean {
  return heldNow()?.businessIds.has(businessId) ?? false;
}

/** A write asked, inside its own turn, for another turn at the same business. */
export class BookingQueueReentered extends Error {
  constructor(businessId: string) {
    super(`booking queue re-entered for business ${businessId}`);
    this.name = "BookingQueueReentered";
  }
}

async function inLine<T>(businessId: string, run: () => Promise<T>): Promise<T> {
  // A write that, inside its own turn, asked for another at the same
  // business would wait on itself for ever. Refuse it at once.
  const held = heldNow();
  if (held?.businessIds.has(businessId)) throw new BookingQueueReentered(businessId);

  let release!: () => void;
  const turn = new Promise<void>((r) => (release = r));
  const ahead = lines.get(businessId) ?? Promise.resolve();
  const tail = ahead.then(() => turn);
  lines.set(businessId, tail);

  let timer: ReturnType<typeof setTimeout> | undefined;
  const reached = await Promise.race([
    ahead.then(() => true),
    new Promise<false>((r) => (timer = setTimeout(() => r(false), WAIT_MS))),
  ]);
  clearTimeout(timer);
  const forget = () => {
    if (lines.get(businessId) === tail) lines.delete(businessId);
  };
  if (!reached) {
    // Our turn passes straight on when it comes, so those behind us
    // are not held up by a request that is no longer waiting.
    release();
    void tail.then(forget);
    throw new BookingQueueBusy();
  }
  const mine: Held = { businessIds: new Set([...(held?.businessIds ?? []), businessId]), active: true };
  try {
    return await holding.run(mine, run);
  } finally {
    // Work the write started and left running keeps this context, but
    // no longer holds the turn.
    mine.active = false;
    release();
    forget();
  }
}

/** No turn in the business's booking queue within the wait. P2028, as a transaction that could not start. */
export class BookingQueueBusy extends Prisma.PrismaClientKnownRequestError {
  constructor() {
    super("The business's booking queue is busy: no turn within the wait.", {
      code: "P2028",
      clientVersion: Prisma.prismaVersion.client,
    });
    this.name = "BookingQueueBusy";
  }
}

export function isBookingQueueBusy(e: unknown): e is BookingQueueBusy {
  return e instanceof BookingQueueBusy;
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
        maxWait: WAIT_MS,
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
export async function inBookingQueue<T>(
  businessId: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>,
  { busyRetries = 0 }: { busyRetries?: number } = {},
): Promise<T> {
  let busy = 0;
  for (let attempt = 1; ; attempt++) {
    try {
      return await queuedTransaction(businessId, write);
    } catch (e) {
      if (isBookingQueueBusy(e)) {
        if (busy++ >= busyRetries) throw e;
        continue;
      }
      if (!(isTransactionStartTimeout(e) || isWriteConflict(e)) || attempt >= ATTEMPTS) throw e;
      await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));
    }
  }
}

/** Prisma P2028: the interactive transaction could not be started in time. */
export function isTransactionStartTimeout(e: unknown): boolean {
  return (
    !(e instanceof BookingQueueBusy) &&
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2028" &&
    /start a transaction/i.test(e.message)
  );
}

/**
 * A write conflict or deadlock; the transaction was rolled back. Prisma
 * reports it as P2034, or as P2010 carrying the Postgres code when it was
 * raised by a raw statement.
 */
function isWriteConflict(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code === "P2034") return true;
  const code = (e.meta as { code?: string } | undefined)?.code;
  return e.code === "P2010" && (code === "40P01" || code === "40001");
}
