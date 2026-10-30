import { beforeEach, describe, expect, it, vi } from "vitest";

const { tokens, user, business, afterEmailVerified } = vi.hoisted(() => ({
  tokens: { findUnique: vi.fn(), delete: vi.fn() },
  user: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  business: { findUnique: vi.fn(), update: vi.fn() },
  afterEmailVerified: vi.fn(async (_userId: string) => true),
}));

vi.mock("@/lib/db", () => ({ db: { emailVerificationToken: tokens, user, business } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ ok: true }) }));
vi.mock("@/lib/business-verification", () => ({ syncVerifiedBadge: async () => {} }));
// Whether to publish is decided in lib/business/publish (owner asked,
// checklist passes, not taken down) and tested there against Postgres.
vi.mock("@/lib/business/publish", () => ({ afterEmailVerified: (u: string) => afterEmailVerified(u) }));
vi.mock("@/lib/env", () => ({ siteUrl: "https://maw3ed.test" }));

import { GET } from "./route";

const future = new Date(Date.now() + 3_600_000);
const follow = async () => {
  const res = await GET(new Request("http://localhost/api/auth/verify-email/confirm?token=abc"));
  return new URL(res.headers.get("location")!).searchParams.get("status");
};

beforeEach(() => {
  vi.clearAllMocks();
  user.findFirst.mockResolvedValue(null);
  user.update.mockResolvedValue({});
  user.updateMany.mockResolvedValue({ count: 1 });
  business.findUnique.mockResolvedValue(null);
  business.update.mockResolvedValue({});
});

describe("GET /api/auth/verify-email/confirm", () => {
  it("applies an email change only when its link is followed", async () => {
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: "new@example.com" });
    expect(await follow()).toBe("changed");
    expect(user.update.mock.calls[0][0]).toMatchObject({
      where: { id: "u1" },
      data: { email: "new@example.com" },
    });
  });

  it("does not hand over an address another account registered meanwhile", async () => {
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: "new@example.com" });
    user.findFirst.mockResolvedValue({ id: "u2" });
    expect(await follow()).toBe("taken");
    expect(user.update).not.toHaveBeenCalled();
  });

  it("verifies the current address and hands the publish decision to the publishing rules", async () => {
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: null });
    business.findUnique.mockResolvedValue({ id: "b1", status: "APPROVED" });
    expect(await follow()).toBe("success");
    expect(afterEmailVerified).toHaveBeenCalledWith("u1");
    // It never publishes directly: that would bypass the checklist and
    // the owner's own decision to publish.
    expect(business.update).not.toHaveBeenCalled();
  });

  it("asks the same question after an email change", async () => {
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: "new@example.com" });
    business.findUnique.mockResolvedValue({ id: "b1", status: "APPROVED" });
    expect(await follow()).toBe("changed");
    expect(afterEmailVerified).toHaveBeenCalledWith("u1");
    expect(business.update).not.toHaveBeenCalled();
  });

  it("says the page is live only when it is, and sends everyone else to setup", async () => {
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: null });
    business.findUnique.mockResolvedValue({ id: "b1", status: "APPROVED", isPublished: false });
    afterEmailVerified.mockResolvedValueOnce(false);
    expect(await follow()).toBe("setup");

    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: null });
    business.findUnique.mockResolvedValue({ id: "b1", status: "APPROVED", isPublished: true });
    afterEmailVerified.mockResolvedValueOnce(false);
    expect(await follow()).toBe("success");
  });

  it("does not ask for an account with no business", async () => {
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: null });
    expect(await follow()).toBe("verified");
    expect(afterEmailVerified).not.toHaveBeenCalled();
  });
});
