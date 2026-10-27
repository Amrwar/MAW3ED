import { describe, it, expect } from "vitest";
import { renewalPeriodEnd, purchasePeriodEnd, canPurchase, priceCentsFor, PERIOD_DAYS, YEAR_DAYS } from "./subscription";

const JAN_1 = new Date("2026-01-01T12:00:00Z");

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

describe("renewalPeriodEnd", () => {
  it("gives a full period to a subscription that has none", () => {
    expect(daysBetween(JAN_1, renewalPeriodEnd(null, JAN_1))).toBe(PERIOD_DAYS);
  });

  it("gives a full period to one that has already lapsed", () => {
    const lapsed = new Date("2025-12-20T12:00:00Z");
    expect(daysBetween(JAN_1, renewalPeriodEnd(lapsed, JAN_1))).toBe(PERIOD_DAYS);
  });

  it("adds to what is left rather than restarting", () => {
    // The bug this fixes: renewing with 11 days still on the clock set
    // the end to now + 30 and silently forfeited the 11.
    const elevenDaysLeft = new Date("2026-01-12T12:00:00Z");
    const end = renewalPeriodEnd(elevenDaysLeft, JAN_1);
    expect(daysBetween(JAN_1, end)).toBe(11 + PERIOD_DAYS);
    expect(daysBetween(elevenDaysLeft, end)).toBe(PERIOD_DAYS);
  });

  it("never shortens a period", () => {
    for (const daysLeft of [1, 7, 29, 60, 365]) {
      const current = new Date(JAN_1.getTime() + daysLeft * 86_400_000);
      expect(renewalPeriodEnd(current, JAN_1).getTime()).toBeGreaterThan(current.getTime());
    }
  });

  it("renewing twice early is worth the same as renewing twice late", () => {
    // Paying early must not cost the owner days, or the only safe time
    // to renew is after the subscription has already stopped working.
    const earlyFirst = renewalPeriodEnd(null, JAN_1);
    const earlySecond = renewalPeriodEnd(earlyFirst, new Date("2026-01-02T12:00:00Z"));
    expect(daysBetween(JAN_1, earlySecond)).toBe(PERIOD_DAYS * 2);
  });
});

describe("a year up front", () => {
  it("adds a year to whatever is left", () => {
    expect(daysBetween(JAN_1, renewalPeriodEnd(null, JAN_1, 12))).toBe(YEAR_DAYS);
    const tenDaysLeft = new Date("2026-01-11T00:00:00Z");
    expect(daysBetween(JAN_1, renewalPeriodEnd(tenDaysLeft, JAN_1, 12))).toBe(10 + YEAR_DAYS);
  });

  it("costs ten months", () => {
    expect(priceCentsFor("PRO", "annual")).toBe(priceCentsFor("PRO") * 10);
    expect(priceCentsFor("PREMIUM", "monthly")).toBe(49900);
  });
});

describe("purchasePeriodEnd", () => {
  const inDays = (n: number) => new Date(JAN_1.getTime() + n * 86_400_000);

  it("adds a renewal of the same plan to what is left", () => {
    const end = purchasePeriodEnd({ currentPlan: "PRO", currentEnd: inDays(100), newPlan: "PRO", months: 1, now: JAN_1 });
    expect(daysBetween(JAN_1, end)).toBe(100 + PERIOD_DAYS);
  });

  it("converts days left on a cheaper plan at the price difference", () => {
    // A year of Pro, then one month of Premium: 365 Pro days are worth
    // 365 × 299/499 ≈ 218 Premium days, not 365.
    const end = purchasePeriodEnd({ currentPlan: "PRO", currentEnd: inDays(365), newPlan: "PREMIUM", months: 1, now: JAN_1 });
    expect(daysBetween(JAN_1, end)).toBe(Math.round((365 * 299) / 499) + PERIOD_DAYS);
  });

  it("gives nothing for the free plan or a period that has run out", () => {
    expect(daysBetween(JAN_1, purchasePeriodEnd({ currentPlan: "FREE", currentEnd: inDays(20), newPlan: "PRO", months: 12, now: JAN_1 }))).toBe(YEAR_DAYS);
    expect(daysBetween(JAN_1, purchasePeriodEnd({ currentPlan: "PRO", currentEnd: inDays(-5), newPlan: "PREMIUM", months: 1, now: JAN_1 }))).toBe(PERIOD_DAYS);
  });
});

describe("canPurchase", () => {
  it("allows an upgrade", () => {
    expect(canPurchase({ currentPlan: "FREE", targetPlan: "PRO", status: "ACTIVE" }).ok).toBe(true);
    expect(canPurchase({ currentPlan: "PRO", targetPlan: "PREMIUM", status: "ACTIVE" }).ok).toBe(true);
  });

  it("allows renewing the same plan, however early", () => {
    // Previously refused more than seven days out, because renewing
    // early used to throw the remaining days away.
    expect(canPurchase({ currentPlan: "PRO", targetPlan: "PRO", status: "ACTIVE" }).ok).toBe(true);
  });

  it("refuses a downgrade, with a reason the owner can act on", () => {
    const result = canPurchase({ currentPlan: "PREMIUM", targetPlan: "PRO", status: "ACTIVE" });
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
  });

  it("lets a lapsed subscription buy anything, including a lower plan", () => {
    // Nothing is being taken away: they are already on FREE in practice.
    expect(canPurchase({ currentPlan: "PREMIUM", targetPlan: "PRO", status: "INACTIVE" }).ok).toBe(true);
  });

  it("treats a trial as free, so any paid plan is an upgrade", () => {
    expect(canPurchase({ currentPlan: "FREE", targetPlan: "PRO", status: "TRIAL" }).ok).toBe(true);
    expect(canPurchase({ currentPlan: "FREE", targetPlan: "PREMIUM", status: "TRIAL" }).ok).toBe(true);
  });
});
