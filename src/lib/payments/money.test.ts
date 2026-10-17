import { describe, it, expect } from "vitest";
import { toCents, fromCents, depositCents, balanceCents, bookingMoney, formatCents } from "./money";

describe("toCents", () => {
  it("converts pounds to piastres", () => {
    expect(toCents(285.5)).toBe(28550);
    expect(toCents(299)).toBe(29900);
    expect(toCents(0.01)).toBe(1);
  });

  it("takes the Decimal shape Prisma hands back", () => {
    // Prisma returns Decimal, which stringifies rather than being a number.
    expect(toCents({ toString: () => "460.00" })).toBe(46000);
    expect(toCents("33.33")).toBe(3333);
  });

  it("does not lose a piastre to floating point", () => {
    // 2.675 * 100 is 267.49999999999997 in IEEE754. Rounding that
    // naively bills the customer a piastre less than the price shown.
    expect(toCents(2.675)).toBe(268);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(8.165)).toBe(817);
  });

  it("refuses something that is not an amount", () => {
    expect(() => toCents("abc")).toThrow();
    expect(() => toCents(Number.NaN)).toThrow();
  });
});

describe("fromCents", () => {
  it("round-trips", () => {
    for (const p of [0.01, 1, 33.33, 285.5, 499, 12345.67]) {
      expect(fromCents(toCents(p))).toBeCloseTo(p, 2);
    }
  });
});

describe("depositCents", () => {
  it("takes the percentage", () => {
    expect(depositCents(285.5, 20)).toBe(5710);
    expect(depositCents(460, 50)).toBe(23000);
  });

  it("rounds up, so the business is never short", () => {
    // 20% of 33.33 is 6.666 piastres short of a whole one.
    expect(depositCents(33.33, 20)).toBe(667);
    expect(depositCents(0.03, 50)).toBe(2);
  });

  it("refuses a percentage that is not a deposit", () => {
    expect(() => depositCents(100, 0)).toThrow();
    expect(() => depositCents(100, 101)).toThrow();
    expect(() => depositCents(100, -5)).toThrow();
    expect(() => depositCents(100, Number.NaN)).toThrow();
  });

  it("takes the whole price at 100%, which the settings allow", () => {
    // The settings route accepts 1–100; 100 used to throw here and
    // turn every booking at such a business into a 500.
    expect(depositCents(150, 100)).toBe(15000);
    expect(depositCents("285.50", 100)).toBe(28550);
    expect(balanceCents(150, depositCents(150, 100))).toBe(0);
  });

  it("is zero on a free service", () => {
    expect(depositCents(0, 25)).toBe(0);
  });
});

describe("bookingMoney", () => {
  const total = 15000;

  it("counts only money that arrived", () => {
    const m = bookingMoney(total, [
      { status: "SUCCEEDED", amountCents: 3750, refundedCents: 0 },
      { status: "FAILED", amountCents: 3750, refundedCents: 0 },
      { status: "PENDING", amountCents: 11250, refundedCents: 0 },
      { status: "ABANDONED", amountCents: 3750, refundedCents: 0 },
    ]);
    expect(m).toEqual({ paidCents: 3750, refundedCents: 0, netPaidCents: 3750, outstandingCents: 11250 });
  });

  it("adds a balance payment and cash to the deposit", () => {
    const m = bookingMoney(total, [
      { status: "SUCCEEDED", amountCents: 3750, refundedCents: 0 },
      { status: "SUCCEEDED", amountCents: 11250, refundedCents: 0 },
    ]);
    expect(m.outstandingCents).toBe(0);
    expect(m.netPaidCents).toBe(15000);
  });

  it("puts refunded money back on what is owed", () => {
    const m = bookingMoney(total, [
      { status: "PARTIALLY_REFUNDED", amountCents: 3750, refundedCents: 1000 },
      { status: "REFUNDED", amountCents: 5000, refundedCents: 5000 },
    ]);
    expect(m).toEqual({ paidCents: 8750, refundedCents: 6000, netPaidCents: 2750, outstandingCents: 12250 });
  });

  it("never owes a negative amount", () => {
    expect(bookingMoney(1000, [{ status: "SUCCEEDED", amountCents: 1500, refundedCents: 0 }]).outstandingCents).toBe(0);
  });
});

describe("balanceCents", () => {
  it("is what is left after the deposit", () => {
    expect(balanceCents(285.5, 5710)).toBe(22840);
    expect(balanceCents(460, 0)).toBe(46000);
  });

  it("is zero once the price is covered", () => {
    expect(balanceCents(285.5, 28550)).toBe(0);
  });

  it("never goes negative", () => {
    // Over-collection is a refund to make, not a negative bill.
    expect(balanceCents(100, 99999)).toBe(0);
  });

  it("deposit plus balance is always the price", () => {
    for (const price of [285.5, 460, 33.33, 0.03, 12345.67]) {
      for (const pct of [10, 20, 33, 50, 75]) {
        const d = depositCents(price, pct);
        expect(d + balanceCents(price, d)).toBe(toCents(price));
      }
    }
  });
});

describe("formatCents", () => {
  it("writes money with two decimals and Latin digits", () => {
    expect(formatCents(28550)).toBe("285.50 ج.م");
    expect(formatCents(100)).toBe("1.00 ج.م");
    expect(formatCents(28550, "EGP", "en")).toBe("285.50 EGP");
  });
});
