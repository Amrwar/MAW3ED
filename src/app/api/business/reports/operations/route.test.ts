import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Revenue and staff commission only for finance.read (final audit F-20).
 * The route was guarded by reports.read alone, which a business grants to
 * a management company with REPORTS — one the database deliberately bars
 * from FINANCE — so it could read revenue and payroll-style commission.
 */

const { actor } = vi.hoisted(() => ({ actor: { current: {} as Record<string, unknown> } }));

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/api", () => ({
  ok: (data: unknown) => Response.json({ data }),
  err: (error: string, status = 400, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status }),
}));
vi.mock("@/lib/business/route", () => ({ businessHandle: (_t: string, fn: () => Promise<Response>) => fn() }));
vi.mock("@/lib/business-access", async () => {
  const real = await vi.importActual<typeof import("@/lib/business-access")>("@/lib/business-access");
  return { can: real.can, requireBusinessAccess: async () => ({ business: { id: "b1" }, actor: actor.current }) };
});
vi.mock("@/lib/reports/operations", async () => {
  const real = await vi.importActual<typeof import("@/lib/reports/operations")>("@/lib/reports/operations");
  return {
    withoutMoney: real.withoutMoney,
    operationsReport: async () => ({
      totals: { booked: 4, completed: 3, cancelled: 1, noShows: 0, walkIns: 0, revenueCents: 90000, noShowRate: 0 },
      staff: [{ id: "s1", name: "سارة", booked: 4, completed: 3, noShows: 0, revenueCents: 90000, commissionPercent: 20, commissionCents: 18000 }],
      resources: [],
      areas: [],
      groups: [],
      packages: { sold: 2, soldCents: 77700, sessionsUsed: 3, membershipsActive: 1, membershipVisits: 2 },
    }),
  };
});

import { GET } from "./route";

const get = async () => (await (await GET(new Request("http://x/api/business/reports/operations?from=2026-11-01&days=1"))).json()).data;

describe("operations report money", () => {
  beforeEach(() => {
    actor.current = {};
  });

  it("gives the owner revenue and commission", async () => {
    actor.current = { role: "OWNER" };
    const r = await get();
    expect(r.totals.revenueCents).toBe(90000);
    expect(r.staff[0].commissionCents).toBe(18000);
  });

  it("gives a delegate with REPORTS but not FINANCE the counts only", async () => {
    actor.current = { role: "DELEGATE", delegation: { actions: ["reports.read"], branchIds: null } };
    const r = await get();
    expect(r.totals.booked).toBe(4);
    expect(r.totals).not.toHaveProperty("revenueCents");
    expect(r.staff[0]).not.toHaveProperty("revenueCents");
    expect(r.staff[0]).not.toHaveProperty("commissionCents");
    expect(r.staff[0]).not.toHaveProperty("commissionPercent");
    expect(r.packages.sold).toBe(2);
    expect(r.packages).not.toHaveProperty("soldCents");
    expect(JSON.stringify(r)).not.toContain("77700");
    expect(JSON.stringify(r)).not.toContain("90000");
  });

  it("gives a delegate granted FINANCE the money", async () => {
    actor.current = { role: "DELEGATE", delegation: { actions: ["reports.read", "finance.read"], branchIds: null } };
    expect((await get()).totals.revenueCents).toBe(90000);
  });
});
