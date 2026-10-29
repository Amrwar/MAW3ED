import { randomBytes } from "crypto";
import { claimRedemption } from "@/lib/discounts/resolve";
import type { TrafficSource } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";
import { bookingInstants, dateToUTC } from "./instants";
import { generateReference } from "./reference";
import { loadAvailability } from "./schedule";
import { minutesToTime, timeToMinutes } from "./time";

/**
 * Creating a booking, safely.
 *
 * The hazard this exists to close: the old flow checked for a conflict
 * and then inserted, as two separate statements. Two requests for the
 * same slot both passed the check and both inserted, and the business
 * found two people in the chair.
 *
 * Three things now stand between that and the database:
 *
 *   1  the slot is re-derived on the server from the same engine that
 *      produced it, so a client cannot submit a time it was not offered
 *      and a time that has gone stale is rejected;
 *   2  the insert runs inside a transaction at Serializable isolation;
 *   3  an exclusion constraint in Postgres rejects any overlap that
 *      slips past both, which is what actually holds under a race.
 *
 * An idempotency key makes a retry safe: the same key returns the
 * booking the first attempt created rather than making a second one.
 */

/** Postgres: exclusion constraint violated. */
const PG_EXCLUSION_VIOLATION = "23P01";
/** Postgres: unique violation — here, a racing idempotency key. */
const PG_UNIQUE_VIOLATION = "23505";
/** Postgres: could not serialize access due to concurrent update. */
const PG_SERIALIZATION_FAILURE = "40001";

export type CreateFailure =
  | { kind: "service-not-found" }
  | { kind: "slot-unavailable"; reason: string | null }
  | { kind: "slot-taken" }
  | { kind: "limit-reached" }
  /** The offer ran out between the quote and the booking. */
  | { kind: "discount-gone" }
  /** More people than the table — or any table — seats. */
  | { kind: "party-too-large" };

export interface CreateBookingInput {
  businessId: string;
  serviceId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  /**
   * Where this booking's emails go: the address typed with it. Kept on
   * the booking, never read back from the Customer record, which
   * anybody who knows the phone number could have filled.
   */
  customerEmail?: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  startTime: string;
  notes?: string | null;
  staffMemberId?: string | null;
  resourceId?: string | null;
  branchId?: string | null;
  partySize?: number | null;
  status: "PENDING" | "PENDING_PAYMENT" | "CONFIRMED";
  totalPrice: Prisma.Decimal | number;
  currency: string;
  depositAmount: number | null;
  /** The channel the visitor arrived through; null when unattributed. */
  source?: TrafficSource | null;
  /**
   * A discount already evaluated against the service price.
   *
   * totalPrice is expected to be the reduced figure — the caller works
   * out both together, so there is no moment where one has been applied
   * and the other has not. What happens here is the part that must be
   * inside the transaction: claiming a redemption against the cap, and
   * recording it.
   */
  discount?: { id: string; amountCents: number } | null;
  /** Client-supplied; a retry with the same value is not a second booking. */
  idempotencyKey?: string | null;
  /** Checked inside the transaction so two requests cannot both be the last. */
  monthlyLimit?: number;
  /**
   * What a booking past monthlyLimit does. "refuse" fails it with
   * limit-reached. "hold" takes it anyway, but never confirmed: it
   * waits for the owner like any booking on a business without
   * auto-confirm. A customer should not meet a business that has
   * stopped taking bookings because of the business's plan.
   */
  overLimit?: "refuse" | "hold";
}

export type CreateBookingResult =
  | { ok: true; booking: BookingRow; reused: boolean }
  | { ok: false; failure: CreateFailure };

type BookingRow = Prisma.BookingGetPayload<{
  select: typeof BOOKING_SELECT;
}>;

const BOOKING_SELECT = {
  id: true,
  reference: true,
  accessToken: true,
  status: true,
  date: true,
  startTime: true,
  endTime: true,
  startsAt: true,
  endsAt: true,
  totalPrice: true,
  currency: true,
  depositAmount: true,
  customerName: true,
  customerPhone: true,
  staffMemberId: true,
  resourceId: true,
  branchId: true,
  partySize: true,
  notes: true,
} satisfies Prisma.BookingSelect;

/**
 * Attempts at the insert. A reference collision draws a new one; a
 * serialization failure — two bookings at one business counting the
 * month together — is retried as a whole, since the overlap constraint
 * still holds whatever the retry does.
 */
const INSERT_ATTEMPTS = 6;

export async function createBooking(
  input: CreateBookingInput,
  now: Date = new Date(),
): Promise<CreateBookingResult> {
  // ── Idempotency, before any work ─────────────────────────
  if (input.idempotencyKey) {
    const existing = await db.booking.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: BOOKING_SELECT,
    });
    if (existing) return { ok: true, booking: existing, reused: true };
  }

  // ── Re-derive the slot on the server ─────────────────────
  //
  // Never trust the time the client sends. This is the same call the
  // slots endpoint makes, so an invented time, a time that is no longer
  // offered, and a time somebody else has just taken all fail here.
  //
  // "Anyone available" is given to the member the engine found free.
  // A booking with nobody on it at a business with staff blocks nobody
  // in particular, which is how two customers ended up in one chair.
  async function derive(): Promise<Plan | CreateFailure> {
    const availability = await loadAvailability(
      {
        businessId: input.businessId,
        serviceId: input.serviceId,
        date: input.date,
        staffMemberId: input.staffMemberId ?? null,
        resourceId: input.resourceId ?? null,
        branchId: input.branchId ?? null,
        partySize: input.partySize ?? null,
      },
      now,
    );
    if (availability.serviceDuration <= 0) return { kind: "service-not-found" };
    if (availability.reason === "party-too-large") return { kind: "party-too-large" };
    if (!availability.slots.includes(input.startTime)) {
      return { kind: "slot-unavailable", reason: availability.reason };
    }
    const endTime = minutesToTime(timeToMinutes(input.startTime) + availability.serviceDuration);
    return {
      staffMemberId: input.staffMemberId ?? availability.assignments[input.startTime] ?? null,
      // "Any table" is given the one the engine found free and fitting,
      // the same way "anyone" is given a free member of staff.
      resourceId: input.resourceId ?? availability.resourceAssignments[input.startTime] ?? null,
      endTime,
      ...bookingInstants(input.date, input.startTime, endTime, availability.serviceDuration),
    };
  }

  let plan = await derive();
  if ("kind" in plan) return { ok: false, failure: plan };

  // ── Insert ───────────────────────────────────────────────
  for (let attempt = 0; attempt < INSERT_ATTEMPTS; attempt++) {
    const { staffMemberId, resourceId, endTime, startsAt, endsAt } = plan;
    // Per attempt: a retried transaction counts the month afresh.
    let status = input.status;
    try {
      const booking = await db.$transaction(
        async (tx) => {
          // Counted inside the transaction so two simultaneous requests
          // cannot both see "one left".
          if (input.monthlyLimit !== undefined && Number.isFinite(input.monthlyLimit)) {
            const used = await tx.booking.count({
              where: countedThisMonth(input.businessId, now),
            });
            if (used >= input.monthlyLimit) {
              if (input.overLimit !== "hold") throw new LimitReached();
              if (status === "CONFIRMED") status = "PENDING";
            }
          }

          const created = await tx.booking.create({
            data: {
              businessId: input.businessId,
              serviceId: input.serviceId,
              customerId: input.customerId,
              customerName: input.customerName,
              customerPhone: input.customerPhone,
              customerEmail: input.customerEmail ?? null,
              date: dateToUTC(input.date),
              startTime: input.startTime,
              endTime,
              startsAt,
              endsAt,
              status,
              totalPrice: input.totalPrice,
              currency: input.currency,
              notes: input.notes ?? null,
              accessToken: randomBytes(32).toString("hex"),
              reference: generateReference(),
              idempotencyKey: input.idempotencyKey ?? null,
              depositAmount: input.depositAmount,
              source: input.source ?? null,
              discountCents: input.discount?.amountCents ?? 0,
              staffMemberId,
              resourceId,
              // Booking.tableId is deliberately not set. It has a foreign
              // key to Table, a resource id is not a table id, and so
              // mirroring one into the other fails the constraint the
              // moment a business schedules anything that was not
              // migrated from the old Table model. Nothing reads the
              // column any more.

              branchId: input.branchId ?? null,
              partySize: input.partySize ?? null,
            },
            select: BOOKING_SELECT,
          });

          // The discount is claimed after the booking exists, inside
          // the same transaction. Claiming it is a conditional update —
          // "increment, but only if there are uses left" — because
          // reading the count and then writing it lets two people both
          // take the last one on a popular offer.
          //
          // Losing the claim rolls the whole thing back rather than
          // quietly charging the customer the full price: they were
          // quoted a number, and a booking that silently costs more
          // than the quote is worse than one that failed.
          if (input.discount) {
            const claimed = await claimRedemption(tx, input.discount.id);
            if (!claimed) throw new DiscountGone();

            await tx.discountRedemption.create({
              data: {
                discountId: input.discount.id,
                bookingId: created.id,
                customerId: input.customerId,
                amountCents: input.discount.amountCents,
              },
            });
          }

          return created;
        },
        {
          // Serializable, because the limit count and the insert have to
          // see a consistent view of the month.
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          // A burst of bookings at one business queues for the connection
          // pool. Each insert holds a connection for milliseconds, but
          // Prisma's default gives a transaction two seconds to *start*,
          // and under fifty simultaneous requests the ones at the back of
          // the queue were failing with "unable to start a transaction"
          // — a 500 for a customer who merely had to wait a moment. They
          // wait now; the overlap constraint still decides who wins.
          maxWait: 10_000,
          timeout: 20_000,
        },
      );

      return { ok: true, booking, reused: false };
    } catch (e) {
      if (e instanceof LimitReached) return { ok: false, failure: { kind: "limit-reached" } };
      if (e instanceof DiscountGone) return { ok: false, failure: { kind: "discount-gone" } };

      // The transaction never began: the pool had no connection to give
      // within Prisma's wait. Nothing was written, so trying again after
      // a short, jittered pause is safe — and under a burst at one
      // business that is exactly what the requests at the back of the
      // queue need. Only when that fails too does the caller see it
      // (the public route answers 503 with Retry-After).
      if (isTransactionStartTimeout(e)) {
        if (attempt < INSERT_ATTEMPTS - 1) {
          await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));
          continue;
        }
        throw e;
      }

      const code = pgCode(e);
      const conflicted =
        code === PG_EXCLUSION_VIOLATION ||
        code === PG_SERIALIZATION_FAILURE ||
        code === PG_UNIQUE_VIOLATION;

      // Whatever the database objected to, if this request carried an
      // idempotency key the first thing to ask is whether its own
      // earlier attempt already succeeded.
      //
      // Two requests with the same key racing hit the overlap
      // constraint, not the key's unique index — they are, after all,
      // asking for the same slot. Reporting "somebody took it" to the
      // caller who took it is both wrong and alarming.
      if (conflicted && input.idempotencyKey) {
        const existing = await db.booking.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: BOOKING_SELECT,
        });
        if (existing) return { ok: true, booking: existing, reused: true };
      }

      // Two transactions at one business read together, or the member
      // (or table) this booking was given went to somebody else a moment
      // earlier. Ask again: another may still be free. Only a time
      // nobody can take any more is "taken".
      const autoAssigned =
        (!input.staffMemberId && staffMemberId !== null) || (!input.resourceId && resourceId !== null);
      if (code === PG_SERIALIZATION_FAILURE || (code === PG_EXCLUSION_VIOLATION && autoAssigned)) {
        const again = await derive();
        if ("kind" in again) {
          return { ok: false, failure: again.kind === "slot-unavailable" ? { kind: "slot-taken" } : again };
        }
        plan = again;
        continue;
      }

      // The slot went to somebody else between the check and the commit.
      // This is the race the constraint exists for.
      if (code === PG_EXCLUSION_VIOLATION) {
        return { ok: false, failure: { kind: "slot-taken" } };
      }

      if (code === PG_UNIQUE_VIOLATION) {
        // A reference collision is just bad luck — draw another one.
        const target = uniqueTarget(e);
        if (target.includes("reference") || target.includes("accessToken")) continue;
        // Someone else's booking already holds this key's slot.
        return { ok: false, failure: { kind: "slot-taken" } };
      }

      throw e;
    }
  }

  log.error("[createBooking] exhausted insert attempts", {
    businessId: input.businessId,
  });
  return { ok: false, failure: { kind: "slot-taken" } };
}

/**
 * The bookings a monthly plan limit counts: made this calendar month
 * (UTC), and not cancelled or failed at payment. Shared with the
 * dashboard's usage warning, so it warns about the number that is
 * actually enforced.
 */
export function countedThisMonth(businessId: string, now: Date = new Date()) {
  return {
    businessId,
    createdAt: {
      gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      lt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    },
    status: { notIn: ["FAILED_PAYMENT", "CANCELLED"] as ("FAILED_PAYMENT" | "CANCELLED")[] },
  };
}

/** What one attempt inserts: the time, who it was given to, and what it holds. */
interface Plan {
  staffMemberId: string | null;
  resourceId: string | null;
  endTime: string;
  startsAt: Date;
  endsAt: Date;
}

/* ─── Error plumbing ─────────────────────────────────────── */

class LimitReached extends Error {}

/** The offer ran out between quoting the price and taking the booking. */
class DiscountGone extends Error {}

/** Prisma P2028: the interactive transaction could not be started in time. */
export function isTransactionStartTimeout(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    e.code === "P2028" &&
    /start a transaction/i.test(e.message)
  );
}

function pgCode(e: unknown): string | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    // Prisma maps some of these to its own P-codes but keeps the
    // original in meta; check both.
    const meta = e.meta as { code?: string } | undefined;
    if (meta?.code) return meta.code;
    if (e.code === "P2002") return PG_UNIQUE_VIOLATION;
    if (e.code === "P2034") return PG_SERIALIZATION_FAILURE;
  }
  const message = e instanceof Error ? e.message : String(e);
  for (const code of [PG_EXCLUSION_VIOLATION, PG_SERIALIZATION_FAILURE, PG_UNIQUE_VIOLATION]) {
    if (message.includes(code)) return code;
  }
  // The constraint is named, which survives whatever wrapping Prisma does.
  if (message.includes("booking_no_overlap")) return PG_EXCLUSION_VIOLATION;
  return null;
}

function uniqueTarget(e: unknown): string {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = e.meta as { target?: string[] | string } | undefined;
    if (Array.isArray(meta?.target)) return meta.target.join(",");
    if (typeof meta?.target === "string") return meta.target;
  }
  return e instanceof Error ? e.message : "";
}
