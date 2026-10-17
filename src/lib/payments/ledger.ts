import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import type {
  Payment,
  PaymentKind,
  PaymentMethod,
  PaymentProvider,
  Plan,
} from "@prisma/client";
import { db } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * The payment ledger.
 *
 * Two rules hold everything else up:
 *
 *   1. A payment row exists before the customer is sent to the
 *      provider. If they close the tab, there is a PENDING row saying
 *      what they were trying to pay and for what, rather than silence.
 *
 *   2. Only `settle()` may write SUCCEEDED, only from a verified
 *      webhook, and it is safe to call twice. Paymob retries anything
 *      it did not hear a clean 200 for, and two retries can arrive at
 *      the same moment.
 *
 * Nothing here trusts an amount, a status or an identifier that came
 * from a browser.
 */

// ─── Recording an intent ──────────────────────────────────────────────────────

export interface OpenPaymentInput {
  kind: PaymentKind;
  businessId: string;
  amountCents: number;
  currency?: string;
  provider?: PaymentProvider;
  /** Required for every kind except SUBSCRIPTION. */
  bookingId?: string | null;
  /** Required for SUBSCRIPTION. */
  plan?: Plan | null;
  /** The provider's order id, once we have one. */
  providerOrderId?: string | null;
}

/**
 * Open a payment, before the customer goes anywhere.
 *
 * The database enforces that a booking payment names a booking and a
 * subscription payment names a plan, so a malformed call fails here
 * rather than producing a row nobody can account for.
 */
export async function openPayment(input: OpenPaymentInput): Promise<Payment> {
  if (input.amountCents <= 0) {
    throw new Error(`refusing to open a payment for ${input.amountCents} piastres`);
  }

  return db.payment.create({
    data: {
      kind: input.kind,
      businessId: input.businessId,
      amountCents: input.amountCents,
      currency: input.currency ?? "EGP",
      provider: input.provider ?? "PAYMOB",
      bookingId: input.kind === "SUBSCRIPTION" ? null : (input.bookingId ?? null),
      plan: input.kind === "SUBSCRIPTION" ? (input.plan ?? null) : null,
      providerOrderId: input.providerOrderId ?? null,
      status: "PENDING",
    },
  });
}

/** Attach the provider's order id once the session has been created. */
export async function attachProviderOrder(
  paymentId: string,
  providerOrderId: string,
): Promise<void> {
  await db.payment.update({
    where: { id: paymentId },
    data: { providerOrderId },
  });
}

// ─── Idempotency ──────────────────────────────────────────────────────────────

export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

/**
 * Claim a webhook delivery.
 *
 * Returns false when this provider has already sent us this event. The
 * unique index does the deciding, not a read-then-write, so two
 * deliveries racing each other cannot both win: one insert succeeds and
 * the other hits the constraint.
 */
export async function claimWebhookEvent(
  provider: PaymentProvider,
  eventId: string,
  payload: unknown,
): Promise<boolean> {
  try {
    await db.webhookEvent.create({
      data: { provider, eventId, payloadHash: hashPayload(payload) },
    });
    return true;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      log.info("[payments] duplicate webhook ignored", { provider, eventId });
      return false;
    }
    throw e;
  }
}

/** Note what we did about a delivery, for support to read later. */
export async function closeWebhookEvent(
  provider: PaymentProvider,
  eventId: string,
  outcome: string,
): Promise<void> {
  await db.webhookEvent
    .update({
      where: { provider_eventId: { provider, eventId } },
      data: { processedAt: new Date(), outcome },
    })
    .catch((e) => log.error("[payments] could not close webhook event", e));
}

/**
 * Give a claim back after the handler failed.
 *
 * The claim exists to stop a delivery being processed twice; it must
 * not stop one being processed at all. If the handler threw, nothing was
 * settled (settling is one transaction), so the row is removed and
 * Paymob's retry can claim it afresh. Only an unprocessed claim is
 * removed: a delivery some other worker finished stays finished.
 */
export async function releaseWebhookEvent(
  provider: PaymentProvider,
  eventId: string,
): Promise<void> {
  await db.webhookEvent
    .deleteMany({ where: { provider, eventId, processedAt: null } })
    .catch((e) =>
      // A claim that cannot be released turns the retry into a
      // "duplicate" — the exact silent loss this exists to prevent —
      // so it is logged as loudly as the original failure.
      log.error("[payments] could not release webhook claim; retry will be dropped", { provider, eventId, e }),
    );
}

// ─── Settling ─────────────────────────────────────────────────────────────────

/**
 * A receipt number a customer can read down the phone.
 *
 * From a sequence rather than a count of rows: two payments settling in
 * the same instant would otherwise be handed the same number, and a
 * receipt number that is not unique is worse than none.
 */
async function nextReceiptNumber(tx: Prisma.TransactionClient): Promise<string> {
  const [row] = await tx.$queryRaw<{ nextval: bigint }[]>`
    SELECT nextval('payment_receipt_seq') AS nextval`;
  return `MW-${String(row.nextval).padStart(6, "0")}`;
}

export interface SettleResult {
  /** False when the payment had already succeeded. */
  changed: boolean;
  payment: Payment;
}

/**
 * Mark a payment as paid, once.
 *
 * Safe to call repeatedly: it only moves a payment out of PENDING or
 * FAILED, so a replay that gets past the webhook-event guard still
 * cannot assign a second receipt number or trigger a side effect twice.
 * The caller does its own work inside `onFirstSettle`, in the same
 * transaction, so the booking and the payment move together or not at
 * all.
 */
export async function settlePayment(params: {
  paymentId: string;
  providerTransactionId: string;
  method?: PaymentMethod | null;
  paidAt?: Date;
  /** Runs only on the settlement that actually changed something. */
  onFirstSettle?: (tx: Prisma.TransactionClient, payment: Payment) => Promise<void>;
}): Promise<SettleResult> {
  const { paymentId, providerTransactionId, method, paidAt, onFirstSettle } = params;

  return db.$transaction(async (tx) => {
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

    // Already settled. Nothing to do, and nothing to repeat.
    if (
      current.status === "SUCCEEDED" ||
      current.status === "REFUNDED" ||
      current.status === "PARTIALLY_REFUNDED"
    ) {
      return { changed: false, payment: current };
    }

    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "SUCCEEDED",
        providerTransactionId,
        method: method ?? current.method,
        paidAt: paidAt ?? new Date(),
        failureReason: null,
        receiptNumber: current.receiptNumber ?? (await nextReceiptNumber(tx)),
      },
    });

    if (onFirstSettle) await onFirstSettle(tx, payment);

    return { changed: true, payment };
  });
}

/** Mark a payment as failed. Never overwrites one that already landed. */
export async function failPayment(params: {
  paymentId: string;
  reason: string;
  providerTransactionId?: string | null;
  onFirstFail?: (tx: Prisma.TransactionClient, payment: Payment) => Promise<void>;
}): Promise<SettleResult> {
  const { paymentId, reason, providerTransactionId, onFirstFail } = params;

  return db.$transaction(async (tx) => {
    const current = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });

    // A payment that already succeeded is not failed by a later
    // callback; that would be a refund, which is its own record.
    if (current.status !== "PENDING") {
      return { changed: false, payment: current };
    }

    const payment = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: "FAILED",
        failureReason: reason.slice(0, 500),
        ...(providerTransactionId ? { providerTransactionId } : {}),
      },
    });

    if (onFirstFail) await onFirstFail(tx, payment);

    return { changed: true, payment };
  });
}

// ─── Money taken in person ────────────────────────────────────────────────────

/**
 * Record a payment that happened at the counter.
 *
 * Settled on creation, because there is no provider to hear back from —
 * the owner saying it happened is the whole of the evidence. It carries
 * who keyed it in for exactly that reason.
 *
 * The "is there that much left to pay" check happens here, inside the
 * transaction, with the booking row locked. Checked outside, two owners
 * (or one double-click) recording the balance at the same moment both
 * read the same outstanding figure and both pass, and the booking ends
 * up paid twice over. FOR UPDATE makes the second wait until the first
 * has committed, so it reads a balance that already includes it.
 */
export async function recordManualPayment(params: {
  businessId: string;
  bookingId: string;
  /** What the booking costs, in piastres. */
  totalCents: number;
  amountCents: number;
  method: PaymentMethod;
  recordedById: string;
  currency?: string;
  /**
   * What a booking still waiting on its deposit must have collected
   * after this payment (its deposit, in piastres). Checked under the
   * same lock, against the status read under it.
   */
  holdCents?: number;
}): Promise<
  | { ok: true; payment: Payment; paidBeforeCents: number }
  | { ok: false; outstandingCents: number; belowDepositCents?: number; closed?: boolean }
> {
  if (params.amountCents <= 0) {
    throw new Error(`refusing to record a payment for ${params.amountCents} piastres`);
  }

  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = ${params.bookingId} FOR UPDATE`;

    const rows = await tx.payment.findMany({
      where: { bookingId: params.bookingId, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } },
      select: { amountCents: true, refundedCents: true },
    });
    const paid = rows.reduce((sum, p) => sum + p.amountCents - p.refundedCents, 0);
    const outstandingCents = Math.max(0, params.totalCents - paid);
    if (params.amountCents > outstandingCents) return { ok: false as const, outstandingCents };

    // Cash below the deposit on a booking that is still waiting for it
    // would leave money recorded against a hold that a declined card or
    // the reaper then releases. Whatever is taken while the booking is
    // held must cover the deposit, which moves it on.
    if (params.holdCents !== undefined) {
      const [row] = await tx.$queryRaw<{ status: string }[]>`
        SELECT "status"::text AS status FROM "Booking" WHERE "id" = ${params.bookingId}`;
      // Released or cancelled since the caller looked (a decline can land
      // in between): its slot may already be somebody else's.
      if (row?.status === "FAILED_PAYMENT" || row?.status === "CANCELLED") {
        return { ok: false as const, outstandingCents, closed: true };
      }
      if (row?.status === "PENDING_PAYMENT" && paid + params.amountCents < params.holdCents) {
        return { ok: false as const, outstandingCents, belowDepositCents: params.holdCents - paid };
      }
    }

    const payment = await tx.payment.create({
      data: {
        kind: paid === 0 ? "BOOKING_FULL" : "BOOKING_BALANCE",
        businessId: params.businessId,
        bookingId: params.bookingId,
        amountCents: params.amountCents,
        currency: params.currency ?? "EGP",
        provider: "MANUAL",
        method: params.method,
        status: "SUCCEEDED",
        paidAt: new Date(),
        recordedById: params.recordedById,
        receiptNumber: await nextReceiptNumber(tx),
      },
    });
    return { ok: true as const, payment, paidBeforeCents: paid };
  });
}

// ─── Reading ──────────────────────────────────────────────────────────────────

/** What has actually been collected against a booking, in piastres. */
export async function paidCentsForBooking(bookingId: string): Promise<number> {
  const rows = await db.payment.findMany({
    where: {
      bookingId,
      status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] },
    },
    select: { amountCents: true, refundedCents: true },
  });
  return rows.reduce((sum, p) => sum + p.amountCents - p.refundedCents, 0);
}

// ─── Refunds ──────────────────────────────────────────────────────────────────

export interface RefundReservation {
  ok: boolean;
  /** Why not, when ok is false. Already a message for a person. */
  reason?: string;
  /** What is left after this reservation. */
  remainingCents: number;
}

/**
 * Reserve part of a payment for refund, before asking the provider.
 *
 * The refund route used to read refundedCents, call Paymob, and then
 * write `the value it read + amount`. Two requests arriving together —
 * two admins, or one impatient double-click — both read the same
 * starting figure, both send a real refund, and both write the same
 * total. The money goes back twice and the ledger records it once.
 *
 * This closes that by moving the decision into the database. The UPDATE
 * is conditional on the amount still fitting, so of two concurrent
 * callers exactly one matches a row and the other gets zero and is
 * refused. Postgres serialises the two updates on the same row, so
 * there is no window between the check and the write for the second to
 * slip through.
 *
 * Reserving before the provider call rather than after is deliberate:
 * an over-reservation can be released, but money already sent cannot be
 * un-sent, so the failure worth having is the one that refunds too
 * little rather than too much.
 */
export async function reserveRefund(
  paymentId: string,
  amountCents: number,
): Promise<RefundReservation> {
  if (amountCents <= 0) {
    return { ok: false, reason: "المبلغ لازم يكون أكبر من صفر", remainingCents: 0 };
  }

  const updated = await db.$executeRaw`
    UPDATE "Payment"
       SET "refundedCents" = "refundedCents" + ${amountCents}
     WHERE "id" = ${paymentId}
       AND "status" IN ('SUCCEEDED', 'PARTIALLY_REFUNDED')
       AND "refundedCents" + ${amountCents} <= "amountCents"`;

  if (updated === 0) {
    // Either it never succeeded, or this would take it past the total.
    // Both are refusals; the caller reads the row to say which.
    const payment = await db.payment.findUnique({
      where: { id: paymentId },
      select: { amountCents: true, refundedCents: true, status: true },
    });
    if (!payment) return { ok: false, reason: "الدفعة غير موجودة", remainingCents: 0 };

    const remaining = payment.amountCents - payment.refundedCents;
    return {
      ok: false,
      reason:
        payment.status !== "SUCCEEDED" && payment.status !== "PARTIALLY_REFUNDED"
          ? "لا يمكن استرجاع دفعة لم تنجح"
          : remaining <= 0
            ? "تم استرجاع هذه الدفعة بالكامل"
            : "المبلغ أكبر من المتبقي",
      remainingCents: Math.max(0, remaining),
    };
  }

  const after = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { amountCents: true, refundedCents: true },
  });
  return { ok: true, remainingCents: after.amountCents - after.refundedCents };
}

/**
 * Give back a reservation the provider refused.
 *
 * Floored at zero so a double release cannot drive the figure negative,
 * which would silently create refundable headroom that was never paid.
 */
export async function releaseRefundReservation(
  paymentId: string,
  amountCents: number,
): Promise<void> {
  await db.$executeRaw`
    UPDATE "Payment"
       SET "refundedCents" = GREATEST(0, "refundedCents" - ${amountCents})
     WHERE "id" = ${paymentId}`;
}

/**
 * Settle the payment's status once a reservation has been paid out.
 *
 * refundedCents is already correct — reserveRefund moved it — so this
 * only brings `status` into line with it.
 */
export async function markRefundOutcome(paymentId: string): Promise<void> {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    select: { amountCents: true, refundedCents: true },
  });
  await db.payment.update({
    where: { id: paymentId },
    data: {
      status: payment.refundedCents >= payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED",
    },
  });
}
