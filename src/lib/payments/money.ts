/**
 * Money arithmetic, in piastres.
 *
 * Prices are stored as Decimal(10,2) in pounds because that is what an
 * owner types. Paymob charges in the minor unit. Every conversion
 * between the two happens here, so there is one place for a rounding
 * rule rather than a `* 100` in each route that drifts from the others.
 *
 * The rule: round to the nearest piastre, half away from zero. Not
 * Math.round, which rounds -0.5 towards zero and would make a refund
 * disagree with the payment it reverses by one piastre.
 */

/** Anything the database or a form might hand us for an amount. */
export type Money = number | string | { toString(): string };

function toNumber(value: Money): number {
  const n = typeof value === "number" ? value : Number(value.toString());
  if (!Number.isFinite(n)) throw new Error(`not an amount: ${String(value)}`);
  return n;
}

/** Pounds to piastres. */
export function toCents(pounds: Money): number {
  const n = toNumber(pounds) * 100;
  // Pounds carry two decimals, so n is already whole to within floating
  // point noise; the epsilon keeps 2.675 * 100 = 267.49999 from
  // becoming 267 instead of 268.
  return Math.sign(n) * Math.round(Math.abs(n) + Number.EPSILON * Math.abs(n));
}

/** Piastres to pounds, for display only — never for further arithmetic. */
export function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * The deposit on a price, in piastres.
 *
 * Rounded up. A 20% deposit on 285.50 is 57.10 exactly, but on 33.33 it
 * is 6.666 — and the business should not be a third of a piastre short
 * because of it.
 *
 * 100 is allowed: the business takes the whole price up front, the
 * deposit is the price, and the balance is zero. The settings route
 * accepts 1–100, so this must too — refusing 100 here made every
 * booking at such a business fail.
 */
export function depositCents(totalPounds: Money, percent: number): number {
  if (!(percent > 0) || percent > 100) {
    throw new Error(`deposit percent out of range: ${percent}`);
  }
  return Math.ceil((toCents(totalPounds) * percent) / 100);
}

/**
 * What is still owed, in piastres.
 *
 * Never negative: a business that over-collected has a refund to make,
 * not a negative balance to bill.
 */
export function balanceCents(totalPounds: Money, alreadyPaidCents: number): number {
  return Math.max(0, toCents(totalPounds) - alreadyPaidCents);
}

/** A ledger row, as far as what the customer has paid is concerned. */
export interface PaymentLine {
  status: string;
  amountCents: number;
  refundedCents: number;
}

export interface BookingMoney {
  /** Everything that arrived, before refunds. */
  paidCents: number;
  /** What has gone back. */
  refundedCents: number;
  /** paid − refunded: what the business is holding. */
  netPaidCents: number;
  /** total − net paid, never negative: what is still owed at the venue. */
  outstandingCents: number;
}

const LANDED = new Set(["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"]);

/**
 * Where a booking's money stands, from every payment against it — the
 * deposit, any balance link, cash at the counter — less refunds.
 *
 * Pending, failed and abandoned attempts never count: only money that
 * arrived does.
 */
export function bookingMoney(totalCents: number, payments: readonly PaymentLine[]): BookingMoney {
  let paidCents = 0;
  let refundedCents = 0;
  for (const p of payments) {
    if (!LANDED.has(p.status)) continue;
    paidCents += p.amountCents;
    refundedCents += Math.min(p.refundedCents, p.amountCents);
  }
  const netPaidCents = paidCents - refundedCents;
  return {
    paidCents,
    refundedCents,
    netPaidCents,
    outstandingCents: Math.max(0, totalCents - netPaidCents),
  };
}

/** For UI: "٢٨٥٫٥٠ ج.م", Latin digits so prices stay scannable. */
export function formatCents(cents: number, currency = "EGP", lang: "ar" | "en" = "ar"): string {
  const amount = fromCents(cents).toLocaleString(
    lang === "ar" ? "ar-EG-u-nu-latn" : "en-EG",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  );
  const unit = lang === "ar" ? (currency === "EGP" ? "ج.م" : currency) : currency;
  return `${amount} ${unit}`;
}
