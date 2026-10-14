import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cash recorded against a booking still waiting on its deposit.
 * The database is faked; what is pinned is the decision taken under the
 * booking-row lock.
 */

const state = { status: "PENDING_PAYMENT", paid: [] as { amountCents: number; refundedCents: number }[], queries: [] as string[], created: 0 };

vi.mock("@/lib/logger", () => ({ log: { info: () => undefined, error: () => undefined, warn: () => undefined } }));
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        $queryRaw: async (strings: TemplateStringsArray) => {
          const sql = strings.join("?");
          state.queries.push(sql);
          if (sql.includes("nextval")) return [{ nextval: BigInt(1) }];
          if (sql.includes('SELECT "status"')) return [{ status: state.status }];
          return [];
        },
        payment: {
          findMany: async () => state.paid,
          create: async ({ data }: { data: Record<string, unknown> }) => {
            state.created++;
            return { id: "p_new", ...data };
          },
        },
      }),
  },
}));

import { recordManualPayment } from "./ledger";

const input = { businessId: "b", bookingId: "bk", totalCents: 15000, method: "CASH" as const, recordedById: "owner", holdCents: 9000 };

describe("cash on a held booking", () => {
  beforeEach(() => {
    Object.assign(state, { status: "PENDING_PAYMENT", paid: [], queries: [], created: 0 });
  });

  it("refuses cash below the deposit, so a later decline cannot release a slot with money on it", async () => {
    const r = await recordManualPayment({ ...input, amountCents: 8000 });
    expect(r).toMatchObject({ ok: false, belowDepositCents: 9000 });
    expect(state.created).toBe(0);
  });

  it("takes cash that covers the deposit", async () => {
    expect((await recordManualPayment({ ...input, amountCents: 9000 })).ok).toBe(true);
  });

  it("counts what already landed towards the deposit", async () => {
    state.paid = [{ amountCents: 5000, refundedCents: 0 }];
    expect((await recordManualPayment({ ...input, amountCents: 4000 })).ok).toBe(true);
  });

  it("refuses a booking released or cancelled since the caller looked", async () => {
    for (const status of ["FAILED_PAYMENT", "CANCELLED"]) {
      state.status = status;
      expect(await recordManualPayment({ ...input, amountCents: 9000 })).toMatchObject({ ok: false, closed: true });
    }
    expect(state.created).toBe(0);
  });

  it("allows part payments once the booking is confirmed", async () => {
    state.status = "CONFIRMED";
    expect((await recordManualPayment({ ...input, amountCents: 100 })).ok).toBe(true);
  });

  it("locks the booking row before reading anything", async () => {
    await recordManualPayment({ ...input, amountCents: 9000 });
    expect(state.queries[0]).toContain("FOR UPDATE");
  });
});
