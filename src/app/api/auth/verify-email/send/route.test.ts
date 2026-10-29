import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "Resend the link" used to wipe a pending change of address and mail a
 * plain link to the old one, so pressing it cancelled the change the
 * person had just asked for.
 */

const { user, tokens, sendEmailVerification } = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  tokens: { findFirst: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  sendEmailVerification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { user, emailVerificationToken: tokens } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ ok: true }), tooManyRequests: () => new Response(null, { status: 429 }) }));
vi.mock("@/auth", () => ({ auth: async () => ({ user: { id: "u1" } }) }));
vi.mock("@/lib/env", () => ({ siteUrl: "https://maw3ed.test" }));
vi.mock("@/lib/services/email", () => ({
  isEmailEnabled: () => true,
  sendEmailVerification: (...a: unknown[]) => sendEmailVerification(...a),
}));

import { POST } from "./route";

/** Answers each findFirst by what it selects: the pending address, or the last send time. */
function tokensAre(pending: string | null) {
  tokens.findFirst.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
    args.select?.email ? (pending ? { email: pending } : null) : null,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tokens.deleteMany.mockResolvedValue({ count: 0 });
  tokens.create.mockResolvedValue({});
  sendEmailVerification.mockResolvedValue({ ok: true });
});

describe("POST /api/auth/verify-email/send", () => {
  it("resends a pending change to the new address, keeping it a change", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", email: "old@example.com", name: "Amr", emailVerified: new Date() });
    tokensAre("new@example.com");
    const res = await POST();
    expect(res.status).toBe(200);
    expect(sendEmailVerification.mock.calls[0][0]).toBe("new@example.com");
    expect(tokens.create.mock.calls[0][0].data.email).toBe("new@example.com");
    // Only change tokens were replaced.
    expect(tokens.deleteMany.mock.calls[0][0].where.email).toEqual({ not: null });
  });

  it("says so when the current address is already verified and nothing is pending", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", email: "old@example.com", name: "Amr", emailVerified: new Date() });
    tokensAre(null);
    const body = await (await POST()).json();
    expect(body.data?.alreadyVerified ?? body.alreadyVerified).toBe(true);
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it("verifies the current address as before when none is pending", async () => {
    user.findUnique.mockResolvedValue({ id: "u1", email: "old@example.com", name: "Amr", emailVerified: null });
    tokensAre(null);
    await POST();
    expect(sendEmailVerification.mock.calls[0][0]).toBe("old@example.com");
    expect(tokens.create.mock.calls[0][0].data.email).toBeNull();
  });
});
