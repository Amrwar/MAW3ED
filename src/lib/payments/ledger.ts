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
 */
export async function recordManualPayment(params: {
  kind: PaymentKind;
  businessId: string;
  bookingId: string;
  amountCents: number;
  method: PaymentMethod;
  recordedById: string;
  currency?: string;
}): Promise<Payment> {
  if (params.amountCents <= 0) {
    throw new Error(`refusing to record a payment for ${params.amountCents} piastres`);
  }

  return db.$transaction(async (tx) => {
    return tx.payment.create({
      data: {
        kind: params.kind,
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
