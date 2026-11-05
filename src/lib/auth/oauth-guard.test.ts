import { beforeEach, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";

/**
 * A Google sign-in in a browser that still carries a revoked session is
 * refused, because NextAuth would otherwise link the Google account to
 * the user that cookie names (lib/auth/oauth-guard.ts). The cookie is a
 * real NextAuth token, encoded the way NextAuth encodes it.
 */

const state = vi.hoisted(() => ({
  cookies: [] as { name: string; value: string }[],
  user: null as null | { sessionsRevokedAt: Date | null },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => state.cookies }),
}));
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: async () => state.user } },
}));

import { carriesRevokedSession, sessionCookieValue } from "./oauth-guard";

const SECRET = "oauth-guard-test-secret-0123456789";
const NAME = "authjs.session-token";
const token = (signedInAt: number) => encode({ token: { sub: "u1", signedInAt }, secret: SECRET, salt: NAME });

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
  state.cookies = [];
  state.user = null;
});

describe("a Google sign-in and the session already in the browser", () => {
  it("is fine with no session cookie at all", async () => {
    expect(await carriesRevokedSession()).toBe(false);
  });

  it("is fine with a live session", async () => {
    state.cookies = [{ name: NAME, value: await token(Date.now() - 1000) }];
    state.user = { sessionsRevokedAt: new Date(Date.now() - 60_000) };
    expect(await carriesRevokedSession()).toBe(false);
  });

  it("refuses a session signed in before 'sign out everywhere'", async () => {
    state.cookies = [{ name: NAME, value: await token(Date.now() - 60_000) }];
    state.user = { sessionsRevokedAt: new Date() };
    expect(await carriesRevokedSession()).toBe(true);
  });

  it("is fine when the cookie's user is gone (NextAuth links nobody then)", async () => {
    state.cookies = [{ name: NAME, value: await token(Date.now() - 60_000) }];
    state.user = null;
    expect(await carriesRevokedSession()).toBe(false);
  });

  it("ignores a cookie it cannot read, as NextAuth does", async () => {
    state.cookies = [{ name: NAME, value: "not-a-token" }];
    state.user = { sessionsRevokedAt: new Date() };
    expect(await carriesRevokedSession()).toBe(false);
  });

  it("joins a chunked cookie in order", () => {
    expect(
      sessionCookieValue(
        [
          { name: `${NAME}.1`, value: "b" },
          { name: "other", value: "x" },
          { name: `${NAME}.0`, value: "a" },
        ],
        NAME,
      ),
    ).toBe("ab");
    expect(sessionCookieValue([{ name: NAME, value: "whole" }], NAME)).toBe("whole");
    expect(sessionCookieValue([], NAME)).toBeNull();
  });
});
