import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashSecret, PHONE_MAX_ATTEMPTS } from "@/lib/verification";

/**
 * A stand-in for the LoginCode table that behaves like Postgres where it
 * matters here: each updateMany / deleteMany is atomic on its own, and
 * reads yield before answering, so concurrent verifications interleave
 * the way parallel requests do — every one of them reads the row before
 * any of them writes.
 */
interface Row { id: string; phone: string; codeHash: string; expiresAt: Date; attempts: number; createdAt: Date }
const rows = new Map<string, Row>();
const tick = () => new Promise((r) => setTimeout(r, 0));

type Where = { id: string; attempts?: { lt?: number; gte?: number } };
const matches = (row: Row | undefined, where: Where): row is Row =>
  !!row &&
  (where.attempts?.lt === undefined || row.attempts < where.attempts.lt) &&
  (where.attempts?.gte === undefined || row.attempts >= where.attempts.gte);

vi.mock("@/lib/db", () => ({
  db: {
    loginCode: {
      findFirst: async ({ where }: { where: { phone: string } }) => {
        // Snapshot now, answer later: every caller in flight sees the
        // row as it was before any of them wrote.
        const row = [...rows.values()].find((r) => r.phone === where.phone);
        const snapshot = row ? { ...row } : null;
        await tick();
        return snapshot;
      },
      updateMany: async ({ where, data }: { where: Where; data: { attempts: { increment: number } } }) => {
        const row = rows.get(where.id);
        if (!matches(row, where)) return { count: 0 };
        row.attempts += data.attempts.increment;
        return { count: 1 };
      },
      deleteMany: async ({ where }: { where: Where }) => {
        const row = rows.get(where.id);
        if (!matches(row, where)) return { count: 0 };
        rows.delete(where.id);
        return { count: 1 };
      },
    },
  },
}));

import { verifyLoginCode } from "./login-code";

const PHONE = "201000000777";
const CODE = "123456";

function seed() {
  rows.clear();
  rows.set("c1", {
    id: "c1",
    phone: PHONE,
    codeHash: hashSecret(CODE),
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    createdAt: new Date(),
  });
}

describe("verifyLoginCode under parallel guessing", () => {
  beforeEach(seed);

  it("counts every one of many concurrent wrong guesses and burns the code", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => verifyLoginCode(PHONE, String(900000 + i))),
    );

    // Only MAX of them ever reached the comparison; the rest were refused
    // before it, because their attempt could not be spent.
    expect(results.filter((r) => !r.ok && r.reason === "wrong")).toHaveLength(PHONE_MAX_ATTEMPTS);
    expect(results.filter((r) => !r.ok && r.reason === "too-many-attempts")).toHaveLength(20 - PHONE_MAX_ATTEMPTS);
    expect(rows.size).toBe(0);
  });

  it("does not let the right code ride in behind a burst of wrong ones", async () => {
    // Under the old read-then-write, all twenty read attempts=0 and all
    // were compared — so the last one, being right, signed in.
    const guesses = Array.from({ length: 19 }, (_, i) => String(900000 + i)).concat(CODE);
    const results = await Promise.all(guesses.map((g) => verifyLoginCode(PHONE, g)));
    expect(results.some((r) => r.ok)).toBe(false);
  });

  it("lets only one of two simultaneous right answers through", async () => {
    const results = await Promise.all([verifyLoginCode(PHONE, CODE), verifyLoginCode(PHONE, CODE)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("still accepts the right code on the last allowed attempt", async () => {
    for (let i = 0; i < PHONE_MAX_ATTEMPTS - 1; i++) {
      expect(await verifyLoginCode(PHONE, "000000")).toEqual({ ok: false, reason: "wrong" });
    }
    expect(await verifyLoginCode(PHONE, CODE)).toEqual({ ok: true, phone: PHONE });
  });

  it("burns the code on the last wrong attempt", async () => {
    for (let i = 0; i < PHONE_MAX_ATTEMPTS; i++) await verifyLoginCode(PHONE, "000000");
    expect(rows.size).toBe(0);
    expect(await verifyLoginCode(PHONE, CODE)).toEqual({ ok: false, reason: "no-code" });
  });
});
