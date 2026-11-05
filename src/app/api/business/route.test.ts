import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A new WhatsApp number is not a verified one (final audit S-10). The
 * profile save kept phoneVerifiedAt, so readiness and the admin view said
 * "phone verified" for a number nobody had proved.
 */

const { state } = vi.hoisted(() => ({ state: { data: null as Record<string, unknown> | null, synced: 0 } }));

vi.mock("@/lib/business-access", () => ({ requireBusinessAccess: async () => ({ business: { id: "b1" } }) }));
vi.mock("@/lib/api", () => ({
  ok: (data: unknown) => Response.json({ data }),
  err: (error: string, status = 400) => Response.json({ error }, { status }),
  requireBusiness: async () => ({ id: "b1" }),
}));
vi.mock("@/lib/logger", () => ({ log: { error: () => undefined, warn: () => undefined, info: () => undefined } }));
vi.mock("@/lib/business-verification", () => ({ syncVerifiedBadge: async () => { state.synced++; return false; } }));
vi.mock("@/lib/db", () => ({
  db: {
    category: { findUnique: async () => null },
    business: {
      findUnique: async () => ({ whatsapp: "+201000000001", phoneVerifiedAt: new Date("2026-10-01") }),
      update: async (args: { data: Record<string, unknown> }) => {
        state.data = args.data;
        return { id: "b1", ...args.data };
      },
    },
  },
}));

import { PUT } from "./route";

const put = (body: unknown) =>
  PUT(new Request("http://x/api/business", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));

describe("PUT /api/business and the verified number", () => {
  beforeEach(() => {
    state.data = null;
    state.synced = 0;
  });

  it("clears the verification when the WhatsApp number changes", async () => {
    const res = await put({ whatsapp: "+201000000002" });
    expect(res.status).toBe(200);
    expect(state.data?.phoneVerifiedAt).toBeNull();
    expect(state.synced).toBe(1);
  });

  it("keeps it when the number is the same", async () => {
    await put({ whatsapp: "+201000000001" });
    expect(state.data).not.toHaveProperty("phoneVerifiedAt");
    expect(state.synced).toBe(0);
  });
});

describe("the same number written another way", () => {
  it("is not a change", async () => {
    state.data = null;
    state.synced = 0;
    await put({ whatsapp: "01000000001" });
    expect(state.data).not.toHaveProperty("phoneVerifiedAt");
  });
});
