import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The Google sign-in decision (lib/auth/google-signin.ts): verified
 * addresses only, never linked into somebody else's live session, and
 * an unverified pre-registered account disarmed before it is linked.
 * The database and the cookies are stand-ins; the DB-backed version of
 * the last rule is google-signin.db.test.ts.
 */

const state = vi.hoisted(() => ({
  signedInAs: null as string | null,
  destination: null as string | null,
  linkedTo: null as string | null,
  byEmail: null as null | { id: string; emailVerified: Date | null },
  transactions: 0,
  updates: [] as unknown[],
}));

vi.mock("@/lib/logger", () => ({ log: { warn: () => undefined, info: () => undefined, error: () => undefined } }));
vi.mock("@/lib/auth/oauth-guard", () => ({
  sessionCookieUser: async () => state.signedInAs,
  signInDestination: async () => state.destination,
}));
vi.mock("@/lib/db", () => ({
  db: {
    account: { findUnique: async () => (state.linkedTo ? { userId: state.linkedTo } : null) },
    user: {
      findUnique: async () => state.byEmail,
      update: (args: unknown) => (state.updates.push(args), args),
    },
    mobileSession: { deleteMany: (args: unknown) => args },
    $transaction: async (ops: unknown[]) => {
      state.transactions++;
      return ops;
    },
  },
}));

import { decideGoogleSignIn } from "./google-signin";

const account = { providerAccountId: "g-123" };
const verified = { email: "Owner@Example.test", email_verified: true };

beforeEach(() => {
  state.signedInAs = null;
  state.destination = null;
  state.linkedTo = null;
  state.byEmail = null;
  state.transactions = 0;
  state.updates = [];
});

describe("the address", () => {
  it("is refused unless Google says it is verified", async () => {
    expect(await decideGoogleSignIn(account, { email: "a@b.test", email_verified: false })).toBe("/login?error=EmailUnverified");
    expect(await decideGoogleSignIn(account, { email: "a@b.test" })).toBe("/login?error=EmailUnverified");
    expect(await decideGoogleSignIn(account, { email: "a@b.test", email_verified: "true" })).toBe("/login?error=EmailUnverified");
    expect(await decideGoogleSignIn(account, { email_verified: true })).toBe("/login?error=EmailUnverified");
  });

  it("goes through when it is", async () => {
    expect(await decideGoogleSignIn(account, verified)).toBe(true);
  });

  it("sends a refusal back to the customer sign-in when that is where it started", async () => {
    state.destination = "/account/favorites";
    expect(await decideGoogleSignIn(account, { email: "a@b.test" })).toBe("/account-login?error=EmailUnverified");
    state.destination = "/en/login";
    expect(await decideGoogleSignIn(account, { email: "a@b.test" })).toBe("/login?error=EmailUnverified");
  });
});

describe("a session already in the browser", () => {
  it("refuses to link a new Google account into the account somebody left signed in", async () => {
    state.signedInAs = "person-a";
    expect(await decideGoogleSignIn(account, verified)).toBe("/login?error=SignedIn");
  });

  it("refuses a Google account that belongs to somebody else", async () => {
    state.signedInAs = "person-a";
    state.linkedTo = "person-b";
    expect(await decideGoogleSignIn(account, verified)).toBe("/login?error=SignedIn");
  });

  it("lets the same person sign in again with their own Google account", async () => {
    state.signedInAs = "person-a";
    state.linkedTo = "person-a";
    expect(await decideGoogleSignIn(account, verified)).toBe(true);
  });

  it("lets the re-sign-in after a merge through (the cookie's user is gone, so it names nobody)", async () => {
    state.signedInAs = null;
    state.linkedTo = "holder";
    expect(await decideGoogleSignIn(account, verified)).toBe(true);
  });
});

describe("an account pre-registered under the address", () => {
  it("is disarmed when its address was never verified: password gone, sessions revoked", async () => {
    state.byEmail = { id: "squatted", emailVerified: null };
    expect(await decideGoogleSignIn(account, verified)).toBe(true);
    expect(state.transactions).toBe(1);
    expect(state.updates).toEqual([
      { where: { id: "squatted" }, data: { password: null, sessionsRevokedAt: expect.any(Date) } },
    ]);
  });

  it("is linked as it is when its owner verified the address", async () => {
    state.byEmail = { id: "owner", emailVerified: new Date() };
    expect(await decideGoogleSignIn(account, verified)).toBe(true);
    expect(state.transactions).toBe(0);
  });

  it("is left alone when this Google account is already linked (nothing is linked by email)", async () => {
    state.linkedTo = "owner";
    state.byEmail = { id: "owner", emailVerified: null };
    expect(await decideGoogleSignIn(account, verified)).toBe(true);
    expect(state.transactions).toBe(0);
  });
});
