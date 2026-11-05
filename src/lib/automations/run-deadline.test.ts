import { describe, expect, it, vi } from "vitest";

/**
 * The operations run stops itself before the platform does (final audit
 * F-28): with no deadline, a long run was killed mid-way and never reached
 * the later jobs.
 */

const { calls } = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({ log: { error: () => undefined, warn: () => undefined, info: () => undefined } }));
vi.mock("@/lib/bookings/slot-waitlist", () => ({ sweepWaitlist: async () => (calls.push("waitlist"), {}) }));
vi.mock("@/lib/loyalty/ledger", () => ({ expireDueLots: async () => (calls.push("loyalty"), {}) }));
vi.mock("@/lib/entitlements/ledger", () => ({ expireEntitlements: async () => (calls.push("entitlements"), {}) }));
vi.mock("@/lib/bookings/rebook", () => ({ rebookHref: () => "/" }));
vi.mock("./send", () => ({ redriveAutomations: async () => (calls.push("redrive"), {}), sendAutoMessage: async () => ({}) }));

import { runOperations } from "./run";

describe("runOperations deadline", () => {
  it("skips every job once the budget is spent, and says which", async () => {
    calls.length = 0;
    const out = await runOperations(new Date(), -1);
    expect(calls).toEqual([]);
    expect(out.skipped).toEqual(["waitlist", "loyaltyExpired", "entitlements", "redriven", "followUps", "rebooks", "renewals", "pointsNotices", "packageNotices"]);
  });

  it("runs retries before new messages", async () => {
    calls.length = 0;
    await runOperations(new Date(), 60_000).catch(() => undefined);
    expect(calls.indexOf("redrive")).toBeGreaterThan(calls.indexOf("entitlements"));
    expect(calls.slice(0, 4)).toEqual(["waitlist", "loyalty", "entitlements", "redrive"]);
  });
});
