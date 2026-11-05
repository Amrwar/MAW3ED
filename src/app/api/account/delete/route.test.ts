import { describe, expect, it, vi } from "vitest";

/**
 * A wrong deletion code is a form error, not an expired session (final
 * audit F-04). Answered with 401, the app refreshed its token and replayed
 * the request, so each typo spent two of the five attempts and the person
 * was told their session had ended.
 */

const { deleteCustomerAccount } = vi.hoisted(() => ({ deleteCustomerAccount: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: { user: { findUnique: vi.fn(async () => ({ phone: "+201000000000" })) } } }));
vi.mock("@/lib/api", () => ({
  ok: (data: unknown) => Response.json({ data }),
  err: (error: string, status = 400, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status }),
  requireSession: async () => ({ user: { id: "u1" } }),
}));
vi.mock("@/lib/auth/login-code", () => ({ verifyLoginCode: vi.fn(async () => ({ ok: false })) }));
vi.mock("@/lib/account/deletion", () => ({ deleteCustomerAccount }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true })), tooManyRequests: vi.fn() }));
vi.mock("@/lib/logger", () => ({ log: { error: () => undefined, warn: () => undefined, info: () => undefined } }));

import { POST } from "./route";

describe("POST /api/account/delete with a wrong code", () => {
  it("answers 422 wrong-code, never 401, and deletes nothing", async () => {
    const res = await POST(
      new Request("http://x/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "123456", confirm: "DELETE" }),
      }),
    );
    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("wrong-code");
    expect(deleteCustomerAccount).not.toHaveBeenCalled();
  });
});
