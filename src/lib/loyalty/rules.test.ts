import { describe, expect, it } from "vitest";
import { availablePoints, drawFromLots, lotExpiry, pointsForVisit, redemptionFor, type ProgramRules } from "./rules";
import { coversService, nextPeriod, pauseRunsOutAt, pauseShift, unusedPackageRefund, MAX_PAUSE_DAYS } from "@/lib/entitlements/rules";
import { noShowTriggered } from "@/lib/bookings/no-show";

const rules: ProgramRules = {
  pointsPerVisit: 10, pointsPer100Egp: 5, redeemPoints: 100, redeemValueCents: 5000,
  maxRedeemPercent: 50, expiryDays: 365, dailyEarnCap: 2,
};
const now = new Date("2026-11-04T12:00:00Z");
const D = 86_400_000;

describe("earning", () => {
  it("gives the visit points plus the spend points, whole numbers only", () => {
    expect(pointsForVisit(rules, 0)).toBe(10);
    expect(pointsForVisit(rules, 20_000)).toBe(20); // 200 EGP: 10 + 2×5
    expect(pointsForVisit(rules, 19_999)).toBe(19); // floor, never rounds up
    expect(pointsForVisit({ ...rules, pointsPer100Egp: 0 }, 1_000_000)).toBe(10);
    expect(pointsForVisit(rules, -500)).toBe(10); // a negative value never takes points away
  });

  it("dates a lot's expiry, or none", () => {
    expect(lotExpiry(rules, now)?.getTime()).toBe(now.getTime() + 365 * D);
    expect(lotExpiry({ expiryDays: null }, now)).toBeNull();
  });
});

describe("redeeming", () => {
  it("spends whole units, capped by the share of the price and the balance", () => {
    // 200 EGP, 50% cap = 100 EGP = 2 units of 50 EGP.
    expect(redemptionFor(rules, 1000, 1000, 20_000)).toEqual({ points: 200, amountCents: 10_000 });
    // Asked 150: one unit only.
    expect(redemptionFor(rules, 150, 1000, 20_000)).toEqual({ points: 100, amountCents: 5000 });
    // Has 99: nothing.
    expect(redemptionFor(rules, 500, 99, 20_000)).toEqual({ points: 0, amountCents: 0 });
    // Price too small for one unit under the cap.
    expect(redemptionFor(rules, 500, 500, 9_999)).toEqual({ points: 0, amountCents: 0 });
    expect(redemptionFor(rules, 500, 500, 0)).toEqual({ points: 0, amountCents: 0 });
  });

  it("never takes more than the price even at a 100% cap", () => {
    const r = redemptionFor({ ...rules, maxRedeemPercent: 100 }, 10_000, 10_000, 12_000);
    expect(r.amountCents).toBeLessThanOrEqual(12_000);
    expect(r).toEqual({ points: 200, amountCents: 10_000 });
  });
});

describe("lots", () => {
  const lots = [
    { id: "never", remaining: 50, expiresAt: null, createdAt: new Date(now.getTime() - 10 * D) },
    { id: "late", remaining: 30, expiresAt: new Date(now.getTime() + 100 * D), createdAt: new Date(now.getTime() - 5 * D) },
    { id: "soon", remaining: 20, expiresAt: new Date(now.getTime() + 1 * D), createdAt: new Date(now.getTime() - 1 * D) },
    { id: "gone", remaining: 40, expiresAt: new Date(now.getTime() - 1), createdAt: new Date(now.getTime() - 20 * D) },
    { id: "empty", remaining: 0, expiresAt: null, createdAt: now },
  ];

  it("counts only unexpired, non-empty lots", () => {
    expect(availablePoints(lots, now)).toBe(100);
  });

  it("draws soonest-expiring first, never-expiring last, and skips expired lots", () => {
    expect(drawFromLots(lots, 60, now)).toEqual({ draws: [{ id: "soon", take: 20 }, { id: "late", take: 30 }, { id: "never", take: 10 }], shortfall: 0 });
    expect(drawFromLots(lots, 130, now).shortfall).toBe(30);
    expect(drawFromLots(lots, 0, now)).toEqual({ draws: [], shortfall: 0 });
  });
});

describe("packages and memberships", () => {
  it("covers the named services, or all when none are named", () => {
    expect(coversService([], "a")).toBe(true);
    expect(coversService(["a"], "a")).toBe(true);
    expect(coversService(["a"], "b")).toBe(false);
  });

  it("renews from the paid date, never resetting, and at most one period ahead", () => {
    const paid = new Date(now.getTime() + 10 * D);
    expect(nextPeriod(paid, 30, now)).toEqual({ startsAt: paid, endsAt: new Date(paid.getTime() + 30 * D) });
    // Lapsed: starts now.
    expect(nextPeriod(new Date(now.getTime() - D), 30, now)?.startsAt).toEqual(now);
    expect(nextPeriod(null, 30, now)?.startsAt).toEqual(now);
    // Already a full period ahead: refused (bounded).
    expect(nextPeriod(new Date(now.getTime() + 30 * D), 30, now)).toBeNull();
  });

  it("bounds a pause by the allowance", () => {
    expect(pauseShift(now, new Date(now.getTime() + 5 * D), 0)).toEqual({ days: 5, ms: 5 * D });
    expect(pauseShift(now, new Date(now.getTime() + 5 * D + 1), 0).days).toBe(5);
    expect(pauseShift(now, new Date(now.getTime() + 60_000), 0).days).toBe(0); // minutes: nothing
    expect(pauseShift(now, new Date(now.getTime() + 90 * D), 0).days).toBe(MAX_PAUSE_DAYS);
    expect(pauseShift(now, new Date(now.getTime() + 90 * D), 50).days).toBe(10);
    expect(pauseShift(now, now, 0).days).toBe(0);
    expect(pauseRunsOutAt(now, 50).getTime()).toBe(now.getTime() + 10 * D);
  });

  it("suggests a pro-rata refund of unused sessions, less what was refunded", () => {
    expect(unusedPackageRefund(50_000, 5, 2, 0)).toBe(30_000);
    expect(unusedPackageRefund(50_000, 5, 2, 10_000)).toBe(20_000);
    expect(unusedPackageRefund(50_000, 5, 5, 0)).toBe(0);
    expect(unusedPackageRefund(50_000, 5, 2, 90_000)).toBe(0);
    expect(unusedPackageRefund(10_000, 3, 1, 0)).toBe(6_666); // floor: never over-refunds
  });
});

describe("no-show policy", () => {
  it("applies only when a limit is set and reached", () => {
    const p = { noShowLimit: 2, noShowWindowDays: 180, noShowAction: "REQUIRE_DEPOSIT" as const };
    expect(noShowTriggered(p, 1)).toBe(false);
    expect(noShowTriggered(p, 2)).toBe(true);
    expect(noShowTriggered({ ...p, noShowLimit: null }, 99)).toBe(false);
    expect(noShowTriggered({ ...p, noShowLimit: 0 }, 99)).toBe(false);
  });
});
