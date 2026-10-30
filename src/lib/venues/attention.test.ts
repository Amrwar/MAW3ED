import { describe, it, expect } from "vitest";
import { venueAttention, type AttentionInput } from "./attention";

const base: AttentionInput = {
  memberships: [],
  gates: [],
  allowedGateIds: [],
  visitorEligibility: "OPEN",
  hasInstructions: false,
  hoursCount: 7,
  isPublished: true,
  notices: [],
  today: "2026-11-01",
};

describe("venueAttention", () => {
  it("is empty for a healthy venue", () => {
    expect(venueAttention(base)).toEqual([]);
  });

  it("puts pending requests first, then hidden tenants, then information", () => {
    const items = venueAttention({
      ...base,
      memberships: [
        { status: "REQUESTED", businessName: "طلب", businessPublished: true, branchActive: null },
        { status: "APPROVED", businessName: "مخفي", businessPublished: false, branchActive: null },
        { status: "APPROVED", businessName: "فرع مقفول", businessPublished: true, branchActive: false },
        { status: "APPROVED", businessName: "سليم", businessPublished: true, branchActive: true },
      ],
      notices: [{ kind: "CLOSED", startsOn: "2026-11-01", endsOn: "2026-11-01" }],
    });
    expect(items.map((i) => i.kind)).toEqual(["pending-requests", "tenant-hidden", "tenant-branch-closed", "notice-today"]);
    expect(items[1].names).toEqual(["مخفي"]);
    expect(items[2].names).toEqual(["فرع مقفول"]);
  });

  it("flags a policy naming an inactive or deleted gate", () => {
    const items = venueAttention({ ...base, gates: [{ id: "g1", isActive: false }], allowedGateIds: ["g1", "gone"] });
    expect(items).toEqual([expect.objectContaining({ kind: "gate-inactive-allowed", count: 2 })]);
  });

  it("flags a public venue with restricted entry and no instructions, or no hours", () => {
    expect(venueAttention({ ...base, visitorEligibility: "BOOKING_REQUIRED" }).map((i) => i.kind)).toEqual(["no-instructions"]);
    expect(venueAttention({ ...base, visitorEligibility: "BOOKING_REQUIRED", hasInstructions: true })).toEqual([]);
    expect(venueAttention({ ...base, hoursCount: 0 }).map((i) => i.kind)).toEqual(["no-hours"]);
    // A draft is not held to what only a public page needs.
    expect(venueAttention({ ...base, hoursCount: 0, isPublished: false })).toEqual([]);
  });

  it("ignores notices that are over or not yet started", () => {
    expect(
      venueAttention({ ...base, notices: [{ kind: "CLOSED", startsOn: "2026-10-01", endsOn: "2026-10-02" }, { kind: "CLOSED", startsOn: "2026-12-01", endsOn: "2026-12-01" }] }),
    ).toEqual([]);
  });
});
