import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A business that renews between the cron's query and its write used
 * to be downgraded anyway: the expiry write was unconditional. It is
 * now conditional on still being overdue, and a business that paid
 * meanwhile is left alone and not told it expired.
 */
const { business, notify } = vi.hoisted(() => ({
  business: { findMany: vi.fn(), updateMany: vi.fn() },
  notify: vi.fn<(event: unknown) => Promise<unknown[]>>(async () => []),
}));

vi.mock("@/lib/db", () => ({ db: { business } }));
vi.mock("@/lib/notifications", () => ({ notify: (event: unknown) => notify(event) }));
vi.mock("@/lib/security/cron-auth", () => ({ authorizeCron: () => ({ ok: true }) }));
vi.mock("@/lib/rate-limit", () => ({ pruneRateLimits: async () => 0 }));
vi.mock("@/lib/logger", () => ({ log: { info: () => undefined, error: () => undefined, warn: () => undefined } }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  business.findMany.mockImplementation(async (args: { where: { currentPeriodEnd: Record<string, unknown> } }) =>
    "lt" in args.where.currentPeriodEnd ? [{ id: "biz", nameAr: "x", currentPeriodEnd: new Date(0), owner: null }] : [],
  );
});

describe("GET /api/cron/subscriptions", () => {
  it("expires a business that is still overdue at the moment of writing", async () => {
    business.updateMany.mockResolvedValue({ count: 1 });
    const body = await (await GET(new Request("http://x/api/cron/subscriptions"))).json();
    expect(body.expired).toBe(1);
    expect(business.updateMany.mock.calls[0][0].where).toMatchObject({ id: "biz", subscriptionStatus: "ACTIVE" });
    expect(business.updateMany.mock.calls[0][0].where.currentPeriodEnd.lt).toBeInstanceOf(Date);
    expect(notify).toHaveBeenCalledWith({ type: "subscription.expired", businessId: "biz" });
  });

  it("leaves a business that renewed meanwhile alone, and does not tell it it expired", async () => {
    business.updateMany.mockResolvedValue({ count: 0 });
    const body = await (await GET(new Request("http://x/api/cron/subscriptions"))).json();
    expect(body.expired).toBe(0);
    expect(notify).not.toHaveBeenCalled();
  });
});
