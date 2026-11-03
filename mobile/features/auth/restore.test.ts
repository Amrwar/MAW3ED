import { describe, expect, it, vi } from "vitest";
import { restoreSession, type RestoreDeps } from "./restore";
import { ApiError, NetworkError, UnauthorizedError } from "@/lib/api/errors";
import type { AuthUser } from "./roles";

const me: AuthUser = { id: "u1", name: "Sara", email: null, businessId: null, adminRole: null };

function deps(fetchMe: () => Promise<AuthUser>, over: Partial<RestoreDeps> = {}) {
  const d = {
    hasTokens: vi.fn(async () => true),
    fetchMe: vi.fn(fetchMe),
    clearTokens: vi.fn(async () => undefined),
    lastUser: vi.fn(async () => me),
    rememberUser: vi.fn(async () => undefined),
    ...over,
  };
  return d;
}

describe("restoring the session on a cold start", () => {
  it("no tokens: nobody, and nothing asked", async () => {
    const d = deps(async () => me, { hasTokens: vi.fn(async () => false) });
    expect(await restoreSession(d)).toEqual({ user: null, verified: true });
    expect(d.fetchMe).not.toHaveBeenCalled();
  });

  it("the server answers: that account, remembered for next time", async () => {
    const d = deps(async () => me);
    expect(await restoreSession(d)).toEqual({ user: me, verified: true });
    expect(d.rememberUser).toHaveBeenCalledWith(me);
    expect(d.clearTokens).not.toHaveBeenCalled();
  });

  it("the server says the session is over: signed out, tokens gone", async () => {
    const d = deps(async () => {
      throw new UnauthorizedError();
    });
    expect(await restoreSession(d)).toEqual({ user: null, verified: true });
    expect(d.clearTokens).toHaveBeenCalledOnce();
  });

  it("no signal: still signed in as the last known account, tokens kept, not verified", async () => {
    const d = deps(async () => {
      throw new NetworkError(new Error("offline"));
    });
    expect(await restoreSession(d)).toEqual({ user: me, verified: false });
    expect(d.clearTokens).not.toHaveBeenCalled();
  });

  it("a server error is not a sign-out either", async () => {
    const d = deps(async () => {
      throw new ApiError(503, "busy");
    });
    expect(await restoreSession(d)).toEqual({ user: me, verified: false });
    expect(d.clearTokens).not.toHaveBeenCalled();
  });

  it("offline with no remembered account: nobody shown, but the tokens are still kept", async () => {
    const d = deps(
      async () => {
        throw new NetworkError(new Error("offline"));
      },
      { lastUser: vi.fn(async () => null) },
    );
    expect(await restoreSession(d)).toEqual({ user: null, verified: false });
    expect(d.clearTokens).not.toHaveBeenCalled();
  });
});
