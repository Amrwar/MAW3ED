import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Representative English answers from a route that refuses through a
 * Zod schema (its own Arabic message, and Zod's default for a missing
 * field) and through err() with a code.
 */

const state = vi.hoisted(() => ({ lang: null as string | null }));
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers(state.lang ? { "x-maw3ed-lang": state.lang } : {})),
  cookies: () => Promise.resolve({ get: () => undefined }),
}));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/db", () => ({ db: { passwordResetToken: { findUnique } } }));
vi.mock("@/lib/auth/mobile-token", () => ({ readAccessToken: async () => null }));
vi.mock("@/lib/organizations/delegation", () => ({ isActingElsewhere: async () => false }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  rateLimit: async () => ({ ok: true }),
}));
vi.mock("@/lib/account/audit-event", () => ({ recordAccountEvent: async () => undefined }));
vi.mock("@/lib/logger", () => ({ log: { error: () => undefined, warn: () => undefined, info: () => undefined } }));

import { POST } from "./route";

const reset = (body: unknown) =>
  POST(new Request("http://x/api/auth/reset-password", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => {
  state.lang = "en";
  findUnique.mockReset();
});

describe("POST /api/auth/reset-password in English", () => {
  it("words the schema's own message", async () => {
    const res = await reset({ token: "t", password: "short" });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("The password must be at least 8 characters.");
  });

  it("words Zod's default for a missing field", async () => {
    const res = await reset({ password: "long-enough-password" });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("Some details are missing. Check the required fields.");
  });

  it("words a refusal with a code, keeping the code", async () => {
    findUnique.mockResolvedValue(null);
    const res = await reset({ token: "t", password: "long-enough-password" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "invalid-token", error: "This link isn't valid or has expired." });
  });

  it("stays Arabic for an Arabic request", async () => {
    state.lang = "ar";
    const res = await reset({ token: "t", password: "short" });
    expect((await res.json()).error).toBe("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
  });
});
