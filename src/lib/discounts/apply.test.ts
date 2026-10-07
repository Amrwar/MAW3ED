import { describe, it, expect } from "vitest";
import {
  bestAutomaticDiscount,
  discountAmount,
  evaluateDiscount,
  normaliseCode,
  FAILURE_AR,
  type DiscountContext,
  type DiscountRules,
} from "./apply";

const NOW = new Date("2026-10-07T12:00:00Z");

function rules(over: Partial<DiscountRules> = {}): DiscountRules {
  return {
    id: "d1",
    code: "EID20",
    kind: "PERCENT",
    value: 20,
    minSpendCents: null,
    maxDiscountCents: null,
    maxRedemptions: null,
    perCustomerLimit: null,
    redemptionCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    serviceIds: [],
    ...over,
  };
}

function ctx(over: Partial<DiscountContext> = {}): DiscountContext {
  return { subtotalCents: 28550, serviceId: "svc1", customerRedemptions: 0, now: NOW, ...over };
}

describe("discountAmount", () => {
  it("takes a percentage", () => {
    expect(discountAmount(rules({ kind: "PERCENT", value: 20 }), 28550)).toBe(5710);
    expect(discountAmount(rules({ kind: "PERCENT", value: 50 }), 46000)).toBe(23000);
  });

  it("rounds a percentage down, so it never takes more than it says", () => {
    // 33% of 100.00 is 33.33 exactly; of 33.33 it is 10.9989.
    expect(discountAmount(rules({ kind: "PERCENT", value: 33 }), 3333)).toBe(1099);
  });

  it("takes a fixed amount", () => {
    expect(discountAmount(rules({ kind: "FIXED", value: 5000 }), 28550)).toBe(5000);
  });

  it("never makes a booking cost less than nothing", () => {
    // A 100 EGP coupon on a 30 EGP service makes it free, not -70.
    expect(discountAmount(rules({ kind: "FIXED", value: 10000 }), 3000)).toBe(3000);
  });

  it("respects a ceiling on a percentage", () => {
    // Half price on an expensive service can cost far more than the
    // offer was meant to; the cap is what stops it.
    const half = rules({ kind: "PERCENT", value: 50, maxDiscountCents: 10000 });
    expect(discountAmount(half, 46000)).toBe(10000);
    expect(discountAmount(half, 10000)).toBe(5000);
  });
});

describe("evaluateDiscount", () => {
  it("applies a straightforward code", () => {
    const out = evaluateDiscount(rules(), ctx());
    expect(out).toEqual({ ok: true, amountCents: 5710, totalCents: 22840 });
  });

  it("the amount off plus what is left is always the subtotal", () => {
    for (const subtotal of [3000, 28550, 46000, 123456]) {
      for (const value of [5, 20, 33, 50, 99]) {
        const out = evaluateDiscount(rules({ value }), ctx({ subtotalCents: subtotal }));
        if (out.ok) expect(out.amountCents + out.totalCents).toBe(subtotal);
      }
    }
  });

  it("refuses one that is switched off", () => {
    expect(evaluateDiscount(rules({ isActive: false }), ctx())).toEqual({
      ok: false,
      reason: "inactive",
    });
  });

  it("refuses one that has not started and one that has ended", () => {
    expect(
      evaluateDiscount(rules({ startsAt: new Date("2026-11-01T00:00:00Z") }), ctx()),
    ).toEqual({ ok: false, reason: "not-started" });
    expect(
      evaluateDiscount(rules({ endsAt: new Date("2026-10-01T00:00:00Z") }), ctx()),
    ).toEqual({ ok: false, reason: "expired" });
  });

  it("treats the end as exclusive, so an offer ending today is over", () => {
    expect(evaluateDiscount(rules({ endsAt: NOW }), ctx())).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(evaluateDiscount(rules({ endsAt: new Date(NOW.getTime() + 1) }), ctx()).ok).toBe(true);
  });

  it("limits to named services, and empty means all of them", () => {
    expect(evaluateDiscount(rules({ serviceIds: ["svc2"] }), ctx()).ok).toBe(false);
    expect(evaluateDiscount(rules({ serviceIds: ["svc1", "svc2"] }), ctx()).ok).toBe(true);
    // The common case: no list at all is every service, not none.
    expect(evaluateDiscount(rules({ serviceIds: [] }), ctx()).ok).toBe(true);
  });

  it("enforces a minimum spend", () => {
    const r = rules({ minSpendCents: 30000 });
    expect(evaluateDiscount(r, ctx({ subtotalCents: 28550 }))).toEqual({
      ok: false,
      reason: "below-minimum",
    });
    expect(evaluateDiscount(r, ctx({ subtotalCents: 30000 })).ok).toBe(true);
  });

  it("stops when the offer is used up", () => {
    const r = rules({ maxRedemptions: 50, redemptionCount: 50 });
    expect(evaluateDiscount(r, ctx())).toEqual({ ok: false, reason: "exhausted" });
    expect(evaluateDiscount({ ...r, redemptionCount: 49 }, ctx()).ok).toBe(true);
  });

  it("stops a customer using a once-per-person code twice", () => {
    const r = rules({ perCustomerLimit: 1 });
    expect(evaluateDiscount(r, ctx({ customerRedemptions: 1 }))).toEqual({
      ok: false,
      reason: "customer-limit",
    });
    expect(evaluateDiscount(r, ctx({ customerRedemptions: 0 })).ok).toBe(true);
  });

  it("refuses a code worth nothing rather than pretending it worked", () => {
    // A customer who typed a code deserves to be told it did nothing.
    const r = rules({ kind: "PERCENT", value: 1 });
    expect(evaluateDiscount(r, ctx({ subtotalCents: 50 }))).toEqual({
      ok: false,
      reason: "no-effect",
    });
  });

  it("reports the first problem, which is the one to act on", () => {
    // Expired and over its limit: say expired, because no amount of
    // trying again will fix the other one either.
    const r = rules({
      isActive: false,
      endsAt: new Date("2026-01-01T00:00:00Z"),
      maxRedemptions: 1,
      redemptionCount: 9,
    });
    expect(evaluateDiscount(r, ctx())).toEqual({ ok: false, reason: "inactive" });
  });

  it("has Arabic for every way it can refuse", () => {
    const reasons = [
      "inactive", "not-started", "expired", "wrong-service",
      "below-minimum", "exhausted", "customer-limit", "no-effect",
    ] as const;
    for (const r of reasons) expect(FAILURE_AR[r]).toBeTruthy();
  });
});

describe("bestAutomaticDiscount", () => {
  const promo = (over: Partial<DiscountRules>) => rules({ code: null, ...over });

  it("ignores anything with a code, which must be asked for", () => {
    expect(bestAutomaticDiscount([rules({ code: "EID20" })], ctx())).toBeNull();
  });

  it("picks the one worth most to the customer", () => {
    const best = bestAutomaticDiscount(
      [
        promo({ id: "a", kind: "PERCENT", value: 10 }),
        promo({ id: "b", kind: "PERCENT", value: 25 }),
        promo({ id: "c", kind: "FIXED", value: 2000 }),
      ],
      ctx({ subtotalCents: 28550 }),
    );
    expect(best?.rules.id).toBe("b");
    expect(best?.amountCents).toBe(7137);
  });

  it("skips promotions that do not apply", () => {
    const best = bestAutomaticDiscount(
      [
        promo({ id: "big", kind: "PERCENT", value: 50, minSpendCents: 999999 }),
        promo({ id: "small", kind: "PERCENT", value: 5 }),
      ],
      ctx(),
    );
    expect(best?.rules.id).toBe("small");
  });

  it("breaks a tie towards the offer that ends soonest", () => {
    // So a limited offer is spent before an open-ended one rather than
    // expiring unused beside something identical.
    const best = bestAutomaticDiscount(
      [
        promo({ id: "forever", kind: "PERCENT", value: 10, endsAt: null }),
        promo({ id: "friday", kind: "PERCENT", value: 10, endsAt: new Date("2026-10-09T00:00:00Z") }),
      ],
      ctx(),
    );
    expect(best?.rules.id).toBe("friday");
  });

  it("is null when nothing applies", () => {
    expect(bestAutomaticDiscount([], ctx())).toBeNull();
    expect(bestAutomaticDiscount([promo({ isActive: false })], ctx())).toBeNull();
  });
});

describe("normaliseCode", () => {
  it("is case and space insensitive", () => {
    expect(normaliseCode(" eid20 ")).toBe("EID20");
    expect(normaliseCode("Eid20")).toBe("EID20");
  });
});
