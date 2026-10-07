import { describe, it, expect } from "vitest";
import { toCents, fromCents, depositCents, balanceCents, formatCents } from "./money";

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
    // 0% is not a deposit and 100% is the whole price, which is a
    // different kind of payment and should be booked as one.
    expect(() => depositCents(100, 0)).toThrow();
    expect(() => depositCents(100, 100)).toThrow();
    expect(() => depositCents(100, -5)).toThrow();
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
