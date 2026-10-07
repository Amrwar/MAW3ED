import { describe, it, expect } from "vitest";
import { renewalPeriodEnd, canPurchase, PERIOD_DAYS } from "./subscription";

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
