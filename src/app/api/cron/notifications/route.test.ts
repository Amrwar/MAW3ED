import { describe, expect, it, vi } from "vitest";

const { redrive, authorize } = vi.hoisted(() => ({
  redrive: vi.fn(async () => ({ due: 2, events: 1, sent: 1, staled: 1, orphaned: 0 })),
  authorize: vi.fn(() => ({ ok: true })),
}));

vi.mock("@/lib/notifications", () => ({ notify: vi.fn() }));
vi.mock("@/lib/notifications/outbox", () => ({ redriveNotifications: () => redrive() }));
vi.mock("@/lib/security/cron-auth", () => ({ authorizeCron: () => authorize() }));

import { GET } from "./route";

describe("GET /api/cron/notifications", () => {
  it("re-drives the outbox and reports what it did", async () => {
    const res = await GET(new Request("http://x/api/cron/notifications"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, due: 2, events: 1, sent: 1, staled: 1 });
    expect(redrive).toHaveBeenCalledTimes(1);
  });

  it("refuses without the cron secret", async () => {
    authorize.mockReturnValueOnce({ ok: false, response: new Response("no", { status: 401 }) } as never);
    const res = await GET(new Request("http://x/api/cron/notifications"));
    expect(res.status).toBe(401);
  });
});
