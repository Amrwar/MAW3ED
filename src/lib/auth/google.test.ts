import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Google sign-in as src/auth.ts wires it: registered only once both
 * credentials are set, and refused for an address Google has not
 * verified (with email linking on, that refusal is what keeps a Google
 * account from claiming somebody else's Maw3ed account by its address).
 *
 * NextAuth itself is replaced by a stub that keeps the config it is
 * given, so the test reads the real providers and callbacks.
 */

const state = vi.hoisted(() => ({
  config: null as null | {
    providers: { id: string; options?: Record<string, unknown> }[];
    callbacks: { signIn: (p: unknown) => Promise<boolean> | boolean };
  },
  revoked: false,
}));

vi.mock("next-auth", () => ({
  default: (config: typeof state.config) => {
    state.config = config;
    return { auth: vi.fn(), handlers: {}, signIn: vi.fn(), signOut: vi.fn() };
  },
}));
vi.mock("@auth/prisma-adapter", () => ({ PrismaAdapter: () => ({}) }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(), callerKey: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: { warn: () => undefined, info: () => undefined, error: () => undefined } }));
vi.mock("@/lib/auth/oauth-guard", () => ({ carriesRevokedSession: async () => state.revoked }));

/** A Credentials provider carries the id it was given in its options until NextAuth merges them. */
const idOf = (p: { id: string; options?: Record<string, unknown> }) => (p.options?.id as string | undefined) ?? p.id;

async function load(env: { id?: string; secret?: string }) {
  vi.resetModules();
  state.config = null;
  if (env.id === undefined) delete process.env.AUTH_GOOGLE_ID;
  else process.env.AUTH_GOOGLE_ID = env.id;
  if (env.secret === undefined) delete process.env.AUTH_GOOGLE_SECRET;
  else process.env.AUTH_GOOGLE_SECRET = env.secret;
  await import("@/auth");
  return state.config!;
}

afterEach(() => {
  delete process.env.AUTH_GOOGLE_ID;
  delete process.env.AUTH_GOOGLE_SECRET;
  state.revoked = false;
});

describe("the Google provider", () => {
  it("is not registered without credentials, and the other two still are", async () => {
    const config = await load({});
    expect(config.providers.map(idOf)).toEqual(["credentials", "phone-otp"]);
  });

  it("is not registered with only one of the two", async () => {
    expect((await load({ id: "client-id" })).providers.map(idOf)).not.toContain("google");
    expect((await load({ secret: "client-secret" })).providers.map(idOf)).not.toContain("google");
    expect((await load({ id: "  ", secret: "client-secret" })).providers.map(idOf)).not.toContain("google");
  });

  it("is registered with both, linking by email, and lower-cases the address", async () => {
    const config = await load({ id: "client-id", secret: "client-secret" });
    expect(config.providers.map(idOf)).toEqual(["credentials", "phone-otp", "google"]);
    const google = config.providers.find((p) => idOf(p) === "google")!;
    expect(google.options?.clientId).toBe("client-id");
    expect(google.options?.allowDangerousEmailAccountLinking).toBe(true);
    const profile = google.options?.profile as (p: Record<string, unknown>) => Record<string, unknown>;
    expect(profile({ sub: "g-1", email: " Amr@Example.COM ", name: "Amr", picture: "https://x/p.png" })).toEqual({
      id: "g-1",
      email: "amr@example.com",
      name: "Amr",
      image: "https://x/p.png",
    });
  });
});

describe("the signIn callback", () => {
  const google = { provider: "google", type: "oidc" };

  it("refuses a Google address Google has not verified", async () => {
    const { callbacks } = await load({ id: "i", secret: "s" });
    expect(await callbacks.signIn({ account: google, profile: { email: "a@b.test", email_verified: false } })).toBe(false);
    expect(await callbacks.signIn({ account: google, profile: { email: "a@b.test" } })).toBe(false);
    // A string "true" is not Google saying yes.
    expect(await callbacks.signIn({ account: google, profile: { email: "a@b.test", email_verified: "true" } })).toBe(false);
    expect(await callbacks.signIn({ account: google, profile: { email_verified: true } })).toBe(false);
  });

  it("accepts a verified one", async () => {
    const { callbacks } = await load({ id: "i", secret: "s" });
    expect(await callbacks.signIn({ account: google, profile: { email: "a@b.test", email_verified: true } })).toBe(true);
  });

  it("refuses when the browser still carries a revoked session", async () => {
    const { callbacks } = await load({ id: "i", secret: "s" });
    state.revoked = true;
    expect(await callbacks.signIn({ account: google, profile: { email: "a@b.test", email_verified: true } })).toBe(false);
  });

  it("leaves the password and phone sign-ins to their own authorize()", async () => {
    const { callbacks } = await load({});
    expect(await callbacks.signIn({ account: { provider: "credentials", type: "credentials" } })).toBe(true);
    expect(await callbacks.signIn({ account: { provider: "phone-otp", type: "credentials" } })).toBe(true);
  });
});
