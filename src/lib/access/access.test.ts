import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ after: (fn: () => unknown) => void fn() }));

import { CODE_PATTERN, deriveCheckInCode, openToken, purposeKey, sameDigest, sealToken, signMessage, verifyMessage } from "./crypto";
import { decideAccess, type EligibilityInput } from "./eligibility";
import { FINAL_REASONS } from "./passes";
import { checkInWindow, extractCode, scanState } from "./check-in";
import { parseEventBody } from "./sandbox";
import { backoffMs, MAX_ATTEMPTS, withTimeout } from "./sync";
import { TransientProviderError, sandboxAllowed } from "./provider";
import { VENUE_PERMISSIONS, authorityOver, venueCan } from "@/lib/venues/access";

/**
 * Phase 23 — the parts of booking QR codes and visitor passes that need
 * no database. Test numbers refer to the Phase 23 acceptance list
 * (docs/testing/ACCESS_ACCEPTANCE_MATRIX.md, which maps every test).
 */

const OLD_ENV = { ...process.env };
beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-for-phase-23-access-tests";
  delete process.env.ACCESS_CREDENTIAL_KEY;
});
afterEach(() => {
  process.env = { ...OLD_ENV };
  vi.useRealTimers();
});

describe("crypto — strong credentials, signatures, key management (tests 2, 14)", () => {
  it("2: check-in codes are 256-bit, derived from a nonce with a server key, and change with the nonce", () => {
    const a = deriveCheckInCode("booking-1", "nonce-a")!;
    expect(a).toMatch(CODE_PATTERN);
    expect(deriveCheckInCode("booking-1", "nonce-a")).toBe(a);
    expect(deriveCheckInCode("booking-1", "nonce-b")).not.toBe(a);
    expect(deriveCheckInCode("booking-2", "nonce-a")).not.toBe(a);
    // Without the key, the database's nonce alone gives nothing.
    process.env.AUTH_SECRET = "another-secret";
    expect(deriveCheckInCode("booking-1", "nonce-a")).not.toBe(a);
    delete process.env.AUTH_SECRET;
    expect(deriveCheckInCode("booking-1", "nonce-a")).toBeNull();
  });

  it("each purpose has its own key; a dedicated key replaces the derived one", () => {
    const k1 = purposeKey("check-in")!;
    const k2 = purposeKey("pass-at-rest")!;
    expect(k1.equals(k2)).toBe(false);
    process.env.ACCESS_CREDENTIAL_KEY = Buffer.alloc(32, 7).toString("base64");
    expect(purposeKey("check-in")!.equals(k1)).toBe(false);
  });

  it("pass tokens are sealed at rest; a tampered or foreign ciphertext does not open", () => {
    const sealed = sealToken("SANDBOX-token")!;
    expect(sealed).not.toContain("SANDBOX-token");
    expect(openToken(sealed)).toBe("SANDBOX-token");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(openToken(parts.join("."))).toBeNull();
    process.env.AUTH_SECRET = "a-different-deployment";
    expect(openToken(sealed)).toBeNull();
  });

  it("14: provider messages: a signature verifies once fresh, fails when altered, stale or from the future (replay)", () => {
    const now = 1_800_000_000;
    const sig = signMessage("k", '{"a":1}', now);
    expect(verifyMessage("k", '{"a":1}', now, sig, now + 10)).toBe(true);
    expect(verifyMessage("k", '{"a":2}', now, sig, now + 10)).toBe(false);
    expect(verifyMessage("other", '{"a":1}', now, sig, now + 10)).toBe(false);
    expect(verifyMessage("k", '{"a":1}', now, sig, now + 301)).toBe(false);
    expect(verifyMessage("k", '{"a":1}', now, sig, now - 301)).toBe(false);
    expect(verifyMessage("k", '{"a":1}', now, "zz", now)).toBe(false);
    expect(verifyMessage("", '{"a":1}', now, sig, now)).toBe(false);
  });

  it("digest comparison is exact", () => {
    expect(sameDigest("ab", "ab")).toBe(true);
    expect(sameDigest("ab", "ac")).toBe(false);
    expect(sameDigest("", "")).toBe(false);
  });
});

const T0 = new Date("2026-11-02T10:00:00Z"); // a real instant
const base = (over: Partial<EligibilityInput> = {}): EligibilityInput => ({
  booking: { status: "CONFIRMED", isTest: false, startsAt: T0, endsAt: new Date(T0.getTime() + 60 * 60_000), branchId: null },
  business: { status: "APPROVED" },
  listings: [{ branchId: null }],
  activeBranchCount: 1,
  venue: { status: "ACTIVE", accessEnabled: true, providerUsable: true },
  policy: {
    visitorEligibility: "BOOKING_REQUIRED", accessBeforeMinutes: 30, accessAfterMinutes: 30, maxGuestsPerBooking: 2,
    reentryAllowed: false, allowedGateIds: ["g1"], identityRequirement: "NAME", lateEntryCutoffMinutes: null, noShowRevokeMinutes: null,
  },
  visitor: { role: "HOLDER", displayName: "Mona", phoneE164: null, removed: false },
  guestIndex: 0,
  accessSuspended: false,
  arrived: false,
  now: new Date(T0.getTime() - 2 * 60 * 60_000),
  ...over,
});

describe("eligibility — booking rules (tests 5, 6, 11, 13)", () => {
  it("5: a confirmed booking at a participating venue is eligible, with the venue's window and gates", () => {
    const d = decideAccess(base());
    expect(d.status).toBe("ELIGIBLE");
    if (d.status !== "ELIGIBLE") return;
    expect(d.validFrom.toISOString()).toBe("2026-11-02T09:30:00.000Z");
    expect(d.validUntil.toISOString()).toBe("2026-11-02T11:30:00.000Z");
    expect(d.allowedGateIds).toEqual(["g1"]);
  });

  it("6: pending, unpaid, cancelled, no-show and test bookings are never eligible; a finished one has expired", () => {
    for (const status of ["PENDING", "PENDING_PAYMENT", "CANCELLED", "NO_SHOW", "FAILED_PAYMENT"]) {
      expect(decideAccess(base({ booking: { ...base().booking, status } })).status, status).toBe("INELIGIBLE");
    }
    expect(decideAccess(base({ booking: { ...base().booking, status: "COMPLETED" } })).status).toBe("EXPIRED");
    expect(decideAccess(base({ booking: { ...base().booking, isTest: true } })).status).toBe("INELIGIBLE");
  });

  it("13: the window passes; the no-show cut-off ends it early for someone who never came", () => {
    expect(decideAccess(base({ now: new Date(T0.getTime() + 91 * 60_000) })).status).toBe("EXPIRED");
    const policy = { ...base().policy!, noShowRevokeMinutes: 15 };
    expect(decideAccess(base({ policy, now: new Date(T0.getTime() + 16 * 60_000) }))).toMatchObject({ status: "EXPIRED", reason: "no-show-cutoff" });
    expect(decideAccess(base({ policy, arrived: true, now: new Date(T0.getTime() + 16 * 60_000) })).status).toBe("ELIGIBLE");
  });

  it("12/22: a business not listed (or only its other branch), a venue off, a venue not admitting by booking: not eligible", () => {
    expect(decideAccess(base({ listings: [] })).status).toBe("INELIGIBLE");
    expect(decideAccess(base({ listings: [{ branchId: "b2" }], booking: { ...base().booking, branchId: "b1" }, activeBranchCount: 2 })).status).toBe("INELIGIBLE");
    expect(decideAccess(base({ venue: { status: "ACTIVE", accessEnabled: false, providerUsable: true } }))).toMatchObject({ reason: "venue-access-off" });
    expect(decideAccess(base({ venue: { status: "ACTIVE", accessEnabled: true, providerUsable: false } }))).toMatchObject({ reason: "no-usable-provider" });
    expect(decideAccess(base({ venue: { status: "SUSPENDED", accessEnabled: true, providerUsable: true } }))).toMatchObject({ reason: "venue-not-active" });
    expect(decideAccess(base({ policy: { ...base().policy!, visitorEligibility: "OPEN" } }))).toMatchObject({ reason: "policy-does-not-admit-by-booking" });
    expect(decideAccess(base({ business: { status: "SUSPENDED" } }))).toMatchObject({ reason: "business-unavailable" });
  });

  it("11: guests within the limit only", () => {
    const guest = { role: "GUEST" as const, displayName: "Ali", phoneE164: null, removed: false };
    expect(decideAccess(base({ visitor: guest, guestIndex: 1 })).status).toBe("ELIGIBLE");
    expect(decideAccess(base({ visitor: guest, guestIndex: 2 }))).toMatchObject({ reason: "over-guest-limit" });
    expect(decideAccess(base({ visitor: { ...guest, removed: true } }))).toMatchObject({ reason: "guest-removed" });
  });

  it("identity — a name always; a phone when the venue requires it", () => {
    const policy = { ...base().policy!, identityRequirement: "NAME_AND_PHONE" as const };
    expect(decideAccess(base({ policy }))).toMatchObject({ reason: "phone-required" });
    expect(decideAccess(base({ policy, visitor: { ...base().visitor, phoneE164: "+201012345678" } })).status).toBe("ELIGIBLE");
    expect(decideAccess(base({ visitor: { ...base().visitor, displayName: "  " } }))).toMatchObject({ reason: "name-required" });
  });

  it("a venue notice suspends instead of ending; a late-entry cut-off narrows entry only", () => {
    expect(decideAccess(base({ accessSuspended: true }))).toMatchObject({ status: "SUSPENDED", reason: "venue-access-suspended" });
    const d = decideAccess(base({ policy: { ...base().policy!, lateEntryCutoffMinutes: 10 } }));
    expect(d.status === "ELIGIBLE" && d.entryUntil?.toISOString()).toBe("2026-11-02T10:10:00.000Z");
  });

  it("only a booking that is over ends a pass for good", () => {
    expect([...FINAL_REASONS].sort()).toEqual(["booking-cancelled", "booking-failed_payment", "booking-no_show", "guest-removed", "test-booking"]);
  });
});

describe("check-in codes follow the booking (tests 2, 7, 13, 15)", () => {
  // Wall-clock frame: a Cairo 14:00 appointment is stored as 14:00Z.
  const b = (status: string) => ({
    status, date: new Date("2026-11-02T00:00:00Z"), startTime: "14:00", endTime: "15:00",
    startsAt: new Date("2026-11-02T14:00:00Z"), endsAt: new Date("2026-11-02T15:00:00Z"),
  });
  // 2026-11-02 in Cairo is UTC+2.
  const at = (cairoHHMM: string) => new Date(`2026-11-02T${cairoHHMM}:00+02:00`);

  it("2/13: valid only in its window — 30 minutes before the start to 30 after the end", () => {
    expect(scanState(b("CONFIRMED"), at("13:29"))).toBe("too-early");
    expect(scanState(b("CONFIRMED"), at("13:30"))).toBe("valid");
    expect(scanState(b("CONFIRMED"), at("15:30"))).toBe("valid");
    expect(scanState(b("CONFIRMED"), at("15:31"))).toBe("expired");
    expect(checkInWindow(b("CONFIRMED")).opensAt.toISOString()).toBe("2026-11-02T13:30:00.000Z");
  });

  it("7: it follows the booking — cancelled, missed, pending and finished bookings do not check in", () => {
    expect(scanState(b("CANCELLED"), at("14:00"))).toBe("cancelled");
    expect(scanState(b("FAILED_PAYMENT"), at("14:00"))).toBe("cancelled");
    expect(scanState(b("NO_SHOW"), at("14:00"))).toBe("no-show");
    expect(scanState(b("PENDING"), at("14:00"))).toBe("not-confirmed");
    expect(scanState(b("COMPLETED"), at("14:00"))).toBe("completed");
  });

  it("15: a second scan of a checked-in booking says so (idempotent)", () => {
    expect(scanState(b("ARRIVED"), at("14:05"))).toBe("checked-in");
    expect(scanState(b("IN_PROGRESS"), at("14:05"))).toBe("checked-in");
  });

  it("14: the scanner accepts a bare code or our /c/ URL, and nothing else", () => {
    const code = "a".repeat(43);
    expect(extractCode(code)).toBe(code);
    expect(extractCode(` https://maw3ed.com/c/${code} `)).toBe(code);
    expect(extractCode(`https://maw3ed.com/c/${code}?x=1`)).toBe(code);
    expect(extractCode("a".repeat(42))).toBeNull();
    expect(extractCode(`https://maw3ed.com/booking/${code}`)).toBeNull();
    expect(extractCode("'; drop table")).toBeNull();
  });
});

describe("provider events are validated before believed (tests 14, 19)", () => {
  const good = { id: "e1", type: "ENTRY_GRANTED", ref: "sbx_1", at: "2026-11-02T10:00:00Z", gate: "G1" };
  it("accepts a well-formed event", () => {
    expect(parseEventBody(JSON.stringify(good))).toMatchObject({ providerEventId: "e1", kind: "ENTRY_GRANTED", providerRef: "sbx_1", gateCode: "G1" });
  });
  it("refuses malformed, unknown, oversized or incomplete ones", () => {
    for (const bad of ["not json", "null", "[]", JSON.stringify({ ...good, type: "OPEN_ALL_GATES" }), JSON.stringify({ ...good, id: "" }),
      JSON.stringify({ ...good, at: "yesterday" }), JSON.stringify({ ...good, ref: "x".repeat(101) }), JSON.stringify({ ...good, ref: undefined })]) {
      expect(parseEventBody(bad), bad).toBeNull();
    }
  });
});

describe("resilience — bounded, backed off, timed out (tests 18, 21, 24)", () => {
  it("backs off 30 s, 1, 2, 4, 8 minutes … capped at an hour, and gives up after MAX_ATTEMPTS", () => {
    expect([1, 2, 3, 4, 5].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000]);
    expect(backoffMs(30)).toBe(3_600_000);
    expect(MAX_ATTEMPTS).toBeLessThanOrEqual(10);
  });

  it("a provider call that never answers is abandoned at the timeout, and the call sees the abort", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const call = withTimeout(
      (signal) =>
        new Promise<never>(() => {
          signal.addEventListener("abort", () => {
            aborted = true;
          });
        }),
      1000,
    );
    const settled = expect(call).rejects.toBeInstanceOf(TransientProviderError);
    await vi.advanceTimersByTimeAsync(1001);
    await settled;
    expect(aborted).toBe(true);
  });
});

describe("the sandbox stays out of production (D)", () => {
  it("never on Vercel; in a production build only with ACCESS_SANDBOX=1; always in tests", () => {
    expect(sandboxAllowed()).toBe(true);
    process.env.VERCEL_ENV = "preview";
    expect(sandboxAllowed()).toBe(false);
    delete process.env.VERCEL_ENV;
    process.env.VERCEL = "1";
    expect(sandboxAllowed()).toBe(false);
    delete process.env.VERCEL;
    vi.stubEnv("NODE_ENV", "production");
    expect(sandboxAllowed()).toBe(false);
    process.env.ACCESS_SANDBOX = "1";
    expect(sandboxAllowed()).toBe(true);
    process.env.VERCEL_ENV = "production";
    expect(sandboxAllowed()).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("venue security role — least privilege (test 20)", () => {
  it("sees and overrides access at its own venue, and nothing else", () => {
    const caller = { platform: false, roles: [{ kind: "VENUE_SECURITY" as const, organizationId: null, compoundId: null, venueId: "v1" }] };
    const a = authorityOver(caller, { id: "v1", organizationId: "o1", compoundId: null });
    expect(a).toBe("VENUE_SECURITY");
    expect(venueCan(a, "venue.access.view")).toBe(true);
    expect(venueCan(a, "venue.access.override")).toBe(true);
    for (const no of ["venue.access.enable", "venue.access.provider", "venue.metrics", "venue.memberships.decide", "venue.policy", "venue.editInfo"] as const) {
      expect(venueCan(a, no), no).toBe(false);
    }
    expect(authorityOver(caller, { id: "v2", organizationId: "o1", compoundId: null })).toBeNull();
  });
  it("only the platform chooses a venue's access provider", () => {
    for (const [k, actions] of Object.entries(VENUE_PERMISSIONS)) {
      expect(actions.includes("venue.access.provider"), k).toBe(k === "PLATFORM");
    }
  });
});
