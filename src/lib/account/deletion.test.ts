import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
const user = { phone: "201000000777", email: "a@b.test", adminRole: null as string | null, isAdmin: false, business: null as { id: string } | null };

vi.mock("@/lib/db", () => {
  const tx = {
    loginCode: { deleteMany: async (q: unknown) => void calls.push(`loginCode:${JSON.stringify(q)}`) },
    passwordResetToken: { deleteMany: async (q: unknown) => void calls.push(`reset:${JSON.stringify(q)}`) },
    user: { delete: async () => void calls.push("user.delete") },
  };
  return {
    db: {
      user: { findUnique: async () => ({ ...user }) },
      $transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx),
    },
  };
});
vi.mock("@/lib/logger", () => ({ log: { info: () => undefined } }));

import { deleteCustomerAccount } from "./deletion";

describe("deleting a customer account", () => {
  beforeEach(() => {
    calls.length = 0;
    user.business = null;
    user.adminRole = null;
  });

  it("removes the codes keyed by phone and email, then the user (which cascades the rest)", async () => {
    expect(await deleteCustomerAccount("u1")).toEqual({ ok: true });
    expect(calls).toEqual([
      'loginCode:{"where":{"phone":"201000000777"}}',
      'reset:{"where":{"email":"a@b.test"}}',
      "user.delete",
    ]);
  });

  it("refuses an owner — deleting the user would take the business and its customers' bookings", async () => {
    user.business = { id: "b1" };
    expect(await deleteCustomerAccount("u1")).toEqual({ ok: false, reason: "owns-business" });
    expect(calls).toEqual([]);
  });

  it("refuses an administrator", async () => {
    user.adminRole = "ADMIN";
    expect(await deleteCustomerAccount("u1")).toEqual({ ok: false, reason: "admin" });
    expect(calls).toEqual([]);
  });
});
