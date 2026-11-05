import { beforeEach, describe, expect, it, vi } from "vitest";
import { encode } from "next-auth/jwt";

/**
 * Reading the browser's session cookie the way NextAuth does, to know
 * whom a Google sign-in would be linked to (lib/auth/oauth-guard.ts).
 * The cookie is a real NextAuth token, encoded as NextAuth encodes it.
 */

const state = vi.hoisted(() => ({
  cookies: [] as { name: string; value: string }[],
  users: new Set<string>(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => state.cookies,
    get: (name: string) => state.cookies.find((c) => c.name === name),
  }),
}));
vi.mock("@/lib/db", () => ({
  db: { user: { findUnique: async ({ where }: { where: { id: string } }) => (state.users.has(where.id) ? { id: where.id } : null) } },
}));

import { sessionCookieUser, sessionCookieValue, signInDestination } from "./oauth-guard";

const SECRET = "oauth-guard-test-secret-0123456789";
const NAME = "authjs.session-token";
const token = (sub: string) => encode({ token: { sub, signedInAt: Date.now() }, secret: SECRET, salt: NAME });

beforeEach(() => {
  process.env.AUTH_SECRET = SECRET;
  state.cookies = [];
  state.users = new Set(["u1"]);
});

describe("whom the browser is signed in as", () => {
  it("nobody without a session cookie", async () => {
    expect(await sessionCookieUser()).toBeNull();
  });

  it("the user the cookie names, when that user exists", async () => {
    state.cookies = [{ name: NAME, value: await token("u1") }];
    expect(await sessionCookieUser()).toBe("u1");
  });

  it("the same under the secure name", async () => {
    state.cookies = [{ name: `__Secure-${NAME}`, value: await encode({ token: { sub: "u1" }, secret: SECRET, salt: `__Secure-${NAME}` }) }];
    expect(await sessionCookieUser()).toBe("u1");
  });

  it("nobody when that user is gone (as after the phone step merged it away)", async () => {
    state.cookies = [{ name: NAME, value: await token("deleted") }];
    expect(await sessionCookieUser()).toBeNull();
  });

  it("nobody for a cookie it cannot read, as for NextAuth", async () => {
    state.cookies = [{ name: NAME, value: "not-a-token" }];
    expect(await sessionCookieUser()).toBeNull();
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

  it("reads where the sign-in was heading from NextAuth's callback-url cookie", async () => {
    expect(await signInDestination()).toBeNull();
    state.cookies = [{ name: "authjs.callback-url", value: "http://localhost:3000/account/favorites" }];
    expect(await signInDestination()).toBe("/account/favorites");
  });
});
