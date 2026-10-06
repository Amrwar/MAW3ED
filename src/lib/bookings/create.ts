import { randomBytes } from "crypto";
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
  | { kind: "limit-reached" };

export interface CreateBookingInput {
  businessId: string;
  serviceId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM */
  startTime: string;
  notes?: string | null;
  staffMemberId?: string | null;
  tableId?: string | null;
  branchId?: string | null;
  partySize?: number | null;
  status: "PENDING" | "PENDING_PAYMENT" | "CONFIRMED";
  totalPrice: Prisma.Decimal | number;
  currency: string;
  depositAmount: number | null;
  /** Client-supplied; a retry with the same value is not a second booking. */
  idempotencyKey?: string | null;
  /** Checked inside the transaction so two requests cannot both be the last. */
  monthlyLimit?: number;
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
  tableId: true,
  branchId: true,
  partySize: true,
  notes: true,
} satisfies Prisma.BookingSelect;

/** A reference is unique platform-wide; collisions are rare but possible. */
const REFERENCE_ATTEMPTS = 6;

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
  const availability = await loadAvailability(
    {
      businessId: input.businessId,
      serviceId: input.serviceId,
      date: input.date,
      staffMemberId: input.staffMemberId ?? null,
      tableId: input.tableId ?? null,
      branchId: input.branchId ?? null,
    },
    now,
  );

  if (availability.serviceDuration <= 0) return { ok: false, failure: { kind: "service-not-found" } };

  if (!availability.slots.includes(input.startTime)) {
    return {
      ok: false,
      failure: { kind: "slot-unavailable", reason: availability.reason },
    };
  }

  const startMin = timeToMinutes(input.startTime);
  const endTime = minutesToTime(startMin + availability.serviceDuration);
  const { startsAt, endsAt } = bookingInstants(
    input.date,
    input.startTime,
    endTime,
    availability.serviceDuration,
  );

  // ── Insert ───────────────────────────────────────────────
  for (let attempt = 0; attempt < REFERENCE_ATTEMPTS; attempt++) {
    try {
      const booking = await db.$transaction(
        async (tx) => {
          // Counted inside the transaction so two simultaneous requests
          // cannot both see "one left".
          if (input.monthlyLimit !== undefined && Number.isFinite(input.monthlyLimit)) {
            const monthStart = new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
            );
            const monthEnd = new Date(
              Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
            );
            const used = await tx.booking.count({
              where: {
                businessId: input.businessId,
                createdAt: { gte: monthStart, lt: monthEnd },
                status: { notIn: ["FAILED_PAYMENT", "CANCELLED"] },
              },
            });
            if (used >= input.monthlyLimit) throw new LimitReached();
          }

          return tx.booking.create({
            data: {
              businessId: input.businessId,
              serviceId: input.serviceId,
              customerId: input.customerId,
              customerName: input.customerName,
              customerPhone: input.customerPhone,
              date: dateToUTC(input.date),
              startTime: input.startTime,
              endTime,
              startsAt,
              endsAt,
              status: input.status,
              totalPrice: input.totalPrice,
              currency: input.currency,
              notes: input.notes ?? null,
              accessToken: randomBytes(32).toString("hex"),
              reference: generateReference(),
              idempotencyKey: input.idempotencyKey ?? null,
              depositAmount: input.depositAmount,
              staffMemberId: input.staffMemberId ?? null,
              tableId: input.tableId ?? null,
              branchId: input.branchId ?? null,
              partySize: input.partySize ?? null,
            },
            select: BOOKING_SELECT,
          });
        },
        {
          // Serializable, because the limit count and the insert have to
          // see a consistent view of the month.
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      );

      return { ok: true, booking, reused: false };
    } catch (e) {
      if (e instanceof LimitReached) return { ok: false, failure: { kind: "limit-reached" } };

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

      // The slot went to somebody else between the check and the commit.
      // This is the race the constraint exists for.
      if (code === PG_EXCLUSION_VIOLATION || code === PG_SERIALIZATION_FAILURE) {
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

  log.error("[createBooking] exhausted reference attempts", {
    businessId: input.businessId,
  });
  return { ok: false, failure: { kind: "slot-taken" } };
}

/* ─── Error plumbing ─────────────────────────────────────── */

class LimitReached extends Error {}

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
