import { describe, expect, it } from "vitest";
import { canAskForPass, guestLink, nextPoll, POLL_MAX, POLL_MS, showsCode } from "./logic";
import type { AccessPayload, PassView } from "@/types/access";

const pass = (over: Partial<PassView> = {}): PassView => ({
  guestId: "g", role: "HOLDER", displayName: "Sara", state: "active", reason: null, validFrom: null, validUntil: null,
  entryUntil: null, gates: [], reentryAllowed: false, pass: { token: "SANDBOX-1", format: "QR", sandbox: true }, canRetry: false,
  qrSvg: "<svg/>", ...over,
});
const payload = (over: Partial<AccessPayload["visitorAccess"]> = {}): AccessPayload => ({
  checkIn: { display: "ready", url: "https://www.maw3ed.net/c/x", qrSvg: "<svg/>", opensAt: "09:30", closesAt: "11:30", checkedInAt: null },
  visitorAccess: {
    offered: true, venue: { id: "v", name: "Mall", instructions: null }, sandbox: true,
    eligibility: { eligible: true, reason: null }, guestLimit: 2, identityRequirement: "NAME", holder: null, guests: [], ...over,
  },
});

describe("asking the server again is bounded", () => {
  it("only while something waits on the access system", () => {
    expect(nextPoll(payload(), 0)).toBe(false);
    expect(nextPoll(payload({ holder: pass({ state: "active" }) }), 0)).toBe(false);
    expect(nextPoll(payload({ holder: pass({ state: "pending", pass: null }) }), 0)).toBe(POLL_MS);
    expect(nextPoll(payload({ guests: [pass({ role: "GUEST", state: "withdrawing" })] }), 3)).toBe(POLL_MS);
    expect(nextPoll(undefined, 0)).toBe(false);
  });
  it("never past POLL_MAX polls, however long it waits", () => {
    const waiting = payload({ holder: pass({ state: "pending", pass: null }) });
    expect(nextPoll(waiting, POLL_MAX - 1)).toBe(POLL_MS);
    expect(nextPoll(waiting, POLL_MAX)).toBe(false);
    expect(nextPoll(waiting, POLL_MAX + 50)).toBe(false);
  });
});

describe("what the screen shows", () => {
  it("a pass code only once the access system confirmed it", () => {
    expect(showsCode(pass())).toBe(true);
    expect(showsCode(pass({ state: "updating" }))).toBe(true);
    for (const state of ["pending", "suspended", "revoked", "expired", "failed", "withdrawing", "ineligible"] as const) {
      expect(showsCode(pass({ state }))).toBe(false);
    }
    expect(showsCode(pass({ pass: null }))).toBe(false);
  });
  it("asking for a pass: offered, eligible, and not asked yet", () => {
    expect(canAskForPass(payload())).toBe(true);
    expect(canAskForPass(payload({ offered: false }))).toBe(false);
    expect(canAskForPass(payload({ eligibility: { eligible: false, reason: "booking-pending" } }))).toBe(false);
    expect(canAskForPass(payload({ holder: pass() }))).toBe(false);
  });
  it("a guest's link is the website's pass page", () => {
    expect(guestLink("https://www.maw3ed.net/", "abc")).toBe("https://www.maw3ed.net/pass/abc");
  });
});
