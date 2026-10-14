import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The reaper's sweep for held bookings with no payment behind them.
 * The database is faked: what is pinned is what the sweep asks for and
 * what it is willing to write.
 */

const calls: { op: string; args: unknown }[] = [];
const orphanRows: { id: string }[] = [];

vi.mock("@/lib/logger", () => ({ log: { info: () => undefined, error: () => undefined, warn: () => undefined } }));
vi.mock("@/lib/db", () => ({
  db: {
    payment: {
      findMany: async () => [],
      findFirst: async () => null,
    },
    business: {
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
    },
    booking: {
      findMany: async (args: unknown) => {
        calls.push({ op: "booking.findMany", args });
        return orphanRows;
      },
      updateMany: async (args: unknown) => {
        calls.push({ op: "booking.updateMany", args });
        return { count: 1 };
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $executeRaw: async (strings: TemplateStringsArray) => {
          calls.push({ op: "lock", args: strings.join("?") });
          return 1;
        },
        booking: {
          updateMany: async (args: unknown) => {
            calls.push({ op: "booking.updateMany", args });
            return { count: 1 };
          },
        },
      }),
  },
}));

import { reapAbandonedPayments } from "./reap";

describe("orphaned holds", () => {
  beforeEach(() => {
    calls.length = 0;
    orphanRows.length = 0;
  });

  it("looks for PENDING_PAYMENT bookings past the window with nothing paying or paid", async () => {
    const now = new Date("2026-10-14T12:00:00Z");
    await reapAbandonedPayments(now);
    const find = calls.find((c) => c.op === "booking.findMany")!.args as { where: Record<string, unknown> };
    expect(find.where.status).toBe("PENDING_PAYMENT");
    expect(find.where.createdAt).toEqual({ lt: new Date("2026-10-14T10:00:00Z") });
    expect(find.where.payments).toEqual({ none: { status: { in: ["PENDING", "SUCCEEDED"] } } });
  });

  it("releases each one, re-checking in the write, to the status that frees the slot", async () => {
    orphanRows.push({ id: "bk_free_service" }, { id: "bk_mismatch" });
    const result = await reapAbandonedPayments(new Date("2026-10-14T12:00:00Z"));
    const writes = calls.filter((c) => c.op === "booking.updateMany").map((c) => c.args as { where: Record<string, unknown>; data: unknown });
    expect(writes).toHaveLength(2);
    for (const w of writes) {
      expect(w.where.status).toBe("PENDING_PAYMENT");
      expect(w.where.payments).toEqual({ none: { status: { in: ["PENDING", "SUCCEEDED"] } } });
      expect(w.data).toEqual({ status: "FAILED_PAYMENT" });
    }
    expect(result.bookingsReleased).toBe(2);
  });

  it("takes the same per-booking lock /pay takes before opening a payment", async () => {
    orphanRows.push({ id: "bk_1" });
    await reapAbandonedPayments(new Date("2026-10-14T12:00:00Z"));
    const ops = calls.map((c) => c.op);
    // The lock comes first, then the conditional write.
    expect(ops.indexOf("lock")).toBeGreaterThanOrEqual(0);
    expect(ops.indexOf("lock")).toBeLessThan(ops.indexOf("booking.updateMany"));
    expect(String(calls.find((c) => c.op === "lock")!.args)).toContain("pg_advisory_xact_lock(hashtext(");
  });
});
