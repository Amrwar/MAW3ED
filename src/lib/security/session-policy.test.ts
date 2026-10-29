import { describe, expect, it } from "vitest";
import { SESSION_RECHECK_MS, needsRecheck, sessionRevoked } from "./session-policy";

describe("web session revocation", () => {
  const t0 = Date.parse("2026-11-01T10:00:00Z");

  it("ends a session signed in before the revocation, keeps one signed in after", () => {
    expect(sessionRevoked(t0, new Date(t0 + 1000))).toBe(true);
    expect(sessionRevoked(t0 + 2000, new Date(t0 + 1000))).toBe(false);
    expect(sessionRevoked(t0, null)).toBe(false);
  });

  it("treats a token from before the field existed as old", () => {
    expect(sessionRevoked(undefined, new Date(t0))).toBe(true);
    expect(sessionRevoked(undefined, null)).toBe(false);
  });

  it("re-reads the account every few minutes, and always the first time", () => {
    expect(needsRecheck(undefined, t0)).toBe(true);
    expect(needsRecheck(t0, t0 + SESSION_RECHECK_MS - 1)).toBe(false);
    expect(needsRecheck(t0, t0 + SESSION_RECHECK_MS + 1)).toBe(true);
  });
});
