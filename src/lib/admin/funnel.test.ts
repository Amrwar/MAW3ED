import { describe, it, expect } from "vitest";
import { computeFunnel, type FunnelEvent } from "./funnel";

const from = new Date("2026-10-01T00:00:00Z");
const to = new Date("2026-11-01T00:00:00Z");
const at = (iso: string) => new Date(iso);

describe("computeFunnel", () => {
  it("follows one cohort: registered in the window, and how far each got", () => {
    const events: FunnelEvent[] = [
      { userId: "a", kind: "BUSINESS_REGISTERED", at: at("2026-10-02T10:00:00Z") },
      { userId: "a", kind: "PUBLISHED", at: at("2026-10-02T14:00:00Z") },
      { userId: "a", kind: "FIRST_BOOKING", at: at("2026-11-03T10:00:00Z") },
      { userId: "b", kind: "BUSINESS_REGISTERED", at: at("2026-10-05T10:00:00Z") },
      { userId: "b", kind: "PUBLISHED", at: at("2026-10-06T00:00:00Z") },
      // Registered before the window: not in this cohort even though it published inside it.
      { userId: "c", kind: "BUSINESS_REGISTERED", at: at("2026-09-01T10:00:00Z") },
      { userId: "c", kind: "PUBLISHED", at: at("2026-10-10T10:00:00Z") },
      // Started, never registered.
      { userId: "d", kind: "ONBOARDING_STARTED", at: at("2026-10-07T10:00:00Z") },
    ];
    const f = computeFunnel(events, from, to);
    expect(f.cohort).toBe(2);
    expect(f.startedNotRegistered).toBe(1);
    const step = (k: string) => f.steps.find((s) => s.kind === k)!;
    expect(step("PUBLISHED").count).toBe(2);
    expect(step("FIRST_BOOKING")).toMatchObject({ count: 1, ofCohort: 50, ofPrevious: 50 });
    expect(step("FIRST_PAID_SUBSCRIPTION").count).toBe(0);
    // 4h and 14h: median 9h.
    expect(f.medianHoursToPublish).toBe(9);
  });

  it("answers zeros, not NaN, for an empty window", () => {
    const f = computeFunnel([], from, to);
    expect(f.cohort).toBe(0);
    expect(f.steps.every((s) => s.ofCohort === 0 && s.ofPrevious === 0)).toBe(true);
    expect(f.medianHoursToPublish).toBeNull();
  });
});
