import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P17-10: an email change must not take effect until a link sent to
 * the new address is followed. Writing it at once let anybody with a
 * phone-code account claim an owner's address before the owner signed
 * up, and then own whatever that address later signed up for.
 */

const { user, tokens, sendEmailVerification } = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  tokens: { findFirst: vi.fn(), deleteMany: vi.fn(), create: vi.fn(), delete: vi.fn() },
  sendEmailVerification: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { user, emailVerificationToken: tokens } }));
// The real module reaches next-auth, which needs Next's runtime.
vi.mock("@/lib/api", () => ({
  ok: (data: unknown) => Response.json({ data }),
  err: (error: string, status = 400, extra: Record<string, unknown> = {}) =>
    Response.json({ error, ...extra }, { status }),
  requireSession: async () => ({ user: { id: "u1" } }),
}));
vi.mock("@/lib/services/email", () => ({
  isEmailEnabled: () => true,
  sendEmailVerification: (...a: unknown[]) => sendEmailVerification(...a),
}));
vi.mock("@/lib/env", () => ({ siteUrl: "https://maw3ed.test" }));

import { PATCH } from "./route";

const patch = (body: unknown) =>
  PATCH(new Request("http://localhost/api/account/profile", { method: "PATCH", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  vi.clearAllMocks();
  user.findUnique.mockResolvedValue({ id: "u1", name: "Amr", email: "old@example.com" });
  user.findFirst.mockResolvedValue(null);
  user.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "u1", name: "Amr", email: "old@example.com", notifyByWhatsApp: true, notifyByEmail: true, ...data }));
  tokens.findFirst.mockResolvedValue(null);
  tokens.create.mockResolvedValue({ id: "tok" });
  tokens.deleteMany.mockResolvedValue({ count: 0 });
  tokens.delete.mockResolvedValue({});
  sendEmailVerification.mockResolvedValue({ ok: true });
});

/** The address the response says is waiting: the newest change token. */
function pendingFromTokens(email: string | null) {
  // pendingEmailFor asks with `email: { not: null }` and an expiry; the
  // cooldown asks for createdAt. Answer each by the select it makes.
  tokens.findFirst.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
    args.select?.email ? (email ? { email } : null) : null,
  );
}

describe("PATCH /api/account/profile — email", () => {
  it("does not write a new address; it sends a link to it instead", async () => {
    pendingFromTokens("owner@biz.com");
    const res = await patch({ email: "Owner@Biz.com" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data?.pendingEmail ?? body.pendingEmail).toBe("owner@biz.com");

    // The account keeps its old address: nothing was written to it.
    expect(user.update).not.toHaveBeenCalled();

    // The token carries the new one, and the link goes there.
    expect(tokens.create.mock.calls[0][0].data.email).toBe("owner@biz.com");
    expect(sendEmailVerification.mock.calls[0][0]).toBe("owner@biz.com");
  });

  it("refuses an address another account holds, whatever its case", async () => {
    user.findFirst.mockResolvedValue({ id: "u2" });
    const res = await patch({ email: "OWNER@biz.com" });
    expect(res.status).toBe(409);
    expect(tokens.create).not.toHaveBeenCalled();
    const where = user.findFirst.mock.calls[0][0].where;
    expect(where.email).toEqual({ equals: "owner@biz.com", mode: "insensitive" });
  });

  it("treats the same address in another case as no change", async () => {
    const res = await patch({ email: "OLD@example.com" });
    expect(res.status).toBe(200);
    expect(tokens.create).not.toHaveBeenCalled();
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it("lets the address be removed without a link", async () => {
    const res = await patch({ email: "" });
    expect(res.status).toBe(200);
    expect(user.update.mock.calls[0][0].data).toMatchObject({ email: null, emailVerified: null });
  });

  it("does not leave a pending change when the link could not be sent", async () => {
    sendEmailVerification.mockResolvedValue({ ok: false, reason: "provider" });
    const res = await patch({ email: "new@example.com" });
    expect(res.status).toBe(502);
    expect(user.update).not.toHaveBeenCalled();
    expect(tokens.delete).toHaveBeenCalledWith({ where: { id: "tok" } });
  });

  it("withdraws a waiting change when the current address is saved again, or removed", async () => {
    await patch({ email: "old@example.com" });
    expect(tokens.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", email: { not: null } } });
    tokens.deleteMany.mockClear();
    await patch({ email: "" });
    expect(tokens.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1", email: { not: null } } });
  });

  it("saves the name even when the change link is throttled", async () => {
    tokens.findFirst.mockImplementation(async (args: { select?: Record<string, boolean> }) =>
      args.select?.createdAt ? { createdAt: new Date() } : null,
    );
    const res = await patch({ name: "Amr H.", email: "new@example.com" });
    expect(res.status).toBe(429);
    expect(user.update.mock.calls[0][0].data).toEqual({ name: "Amr H." });
    expect(sendEmailVerification).not.toHaveBeenCalled();
  });

  it("only counts change links towards the cooldown", async () => {
    await patch({ email: "new@example.com" });
    const where = tokens.findFirst.mock.calls.find((c) => c[0]?.select?.createdAt)?.[0].where;
    expect(where).toMatchObject({ userId: "u1", email: { not: null } });
  });

  it("still saves a name without touching the email", async () => {
    const res = await patch({ name: "Amr H." });
    expect(res.status).toBe(200);
    expect(user.update.mock.calls[0][0].data).toEqual({ name: "Amr H." });
  });
});
