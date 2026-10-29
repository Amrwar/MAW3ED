import { beforeEach, describe, expect, it, vi } from "vitest";

const { tokens, user, business } = vi.hoisted(() => ({
  tokens: { findUnique: vi.fn(), delete: vi.fn() },
  user: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  business: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ db: { emailVerificationToken: tokens, user, business } }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: async () => ({ ok: true }) }));
vi.mock("@/lib/business-verification", () => ({ syncVerifiedBadge: async () => {} }));
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

  it("verifies the current address as before", async () => {
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: null });
    business.findUnique.mockResolvedValue({ id: "b1", status: "APPROVED" });
    expect(await follow()).toBe("success");
    expect(business.update.mock.calls[0][0].data).toEqual({ isPublished: true });
  });

  it("does not republish a business an admin took down", async () => {
    // P17-19: a link re-opened within 24 hours used to put a suspended
    // listing back on the public site.
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: null });
    business.findUnique.mockResolvedValue({ id: "b1", status: "SUSPENDED" });
    await follow();
    expect(business.update).not.toHaveBeenCalled();
  });

  it("publishes a held-back business on an email change too", async () => {
    // An owner who mistyped their address and corrected it has verified
    // an address all the same; the business must not stay unpublished.
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: "new@example.com" });
    business.findUnique.mockResolvedValue({ id: "b1", status: "APPROVED" });
    expect(await follow()).toBe("changed");
    expect(business.update.mock.calls[0][0].data).toEqual({ isPublished: true });
  });

  it("still does not republish a taken-down business on an email change", async () => {
    tokens.findUnique.mockResolvedValue({ id: "t", userId: "u1", expiresAt: future, email: "new@example.com" });
    business.findUnique.mockResolvedValue({ id: "b1", status: "SUSPENDED" });
    await follow();
    expect(business.update).not.toHaveBeenCalled();
  });
});
