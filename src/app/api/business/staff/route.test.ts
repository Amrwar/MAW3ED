import { describe, expect, it, vi } from "vitest";

/**
 * Creating a staff member links only this business's services (final
 * audit S-03). The POST linked whatever service ids it was sent, so a
 * request could attach another business's service and read its name back.
 */

const { created } = vi.hoisted(() => ({ created: [] as unknown[] }));

vi.mock("@/lib/business-access", () => ({
  can: () => true,
  requireBusinessAccess: async () => ({ business: { id: "mine" }, actor: { role: "OWNER" } }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    business: { findUnique: async () => ({ plan: "PREMIUM", subscriptionStatus: "ACTIVE", trialEndsAt: null }) },
    staffMember: {
      count: async () => 0,
      create: async (args: { data: { services?: { create: { serviceId: string }[] } } }) => {
        created.push(args.data.services?.create.map((c) => c.serviceId) ?? []);
        return { id: "s1", loginPhone: null, userId: null, services: [], hours: [] };
      },
    },
    service: {
      findMany: async (args: { where: { businessId: string; id: { in: string[] } } }) =>
        args.where.id.in.filter((id) => id.startsWith("own-")).map((id) => ({ id })),
    },
  },
}));

import { POST } from "./route";

describe("POST /api/business/staff", () => {
  it("drops services that belong to another business", async () => {
    const res = await POST(
      new Request("http://x/api/business/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameAr: "سارة", serviceIds: ["own-1", "theirs-9"] }),
      }),
    );
    expect(res.status).toBe(201);
    expect(created.at(-1)).toEqual(["own-1"]);
  });
});
