import { describe, expect, it, vi } from "vitest";

/**
 * Two guards at the top of createBooking (final audit F-16, F-18).
 *
 * F-16: the plan's monthly allowance counted the UTC month, so a booking
 * made at 01:30 Cairo on 1 December counted toward November.
 * F-18: an idempotency key matched any booking, at any business, and
 * handed it back with its access token.
 */

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { booking: { findUnique } } }));
vi.mock("@/lib/logger", () => ({ log: { error: () => undefined, warn: () => undefined, info: () => undefined } }));
vi.mock("./schedule", () => ({ loadAvailability: vi.fn(async () => { throw new Error("must not get this far"); }) }));

import { countedThisMonth, createBooking, type CreateBookingInput } from "./create";

describe("the monthly allowance window", () => {
  it("is Cairo's month: 01:30 Cairo on 1 December counts toward December", () => {
    // 23:30 UTC on 30 November is 01:30 on 1 December in Cairo (UTC+2).
    const w = countedThisMonth("b", new Date("2026-11-30T23:30:00Z")).createdAt;
    expect(w.gte.toISOString()).toBe("2026-11-30T22:00:00.000Z");
    expect(w.lt.toISOString()).toBe("2026-12-31T22:00:00.000Z");
  });

  it("follows Cairo's summer offset too", () => {
    // Egypt is UTC+3 in July.
    const w = countedThisMonth("b", new Date("2026-07-15T12:00:00Z")).createdAt;
    expect(w.gte.toISOString()).toBe("2026-06-30T21:00:00.000Z");
  });
});

describe("idempotency keys", () => {
  const input = { businessId: "biz-a", idempotencyKey: "k1" } as unknown as CreateBookingInput;

  it("never returns a booking made at another business", async () => {
    findUnique.mockResolvedValueOnce({ id: "bk", accessToken: "secret-token", businessId: "biz-b" });
    const out = await createBooking(input);
    expect(out.ok).toBe(false);
    expect(JSON.stringify(out)).not.toContain("secret-token");
  });

  it("returns this business's own booking for a repeated request", async () => {
    findUnique.mockResolvedValueOnce({ id: "bk", accessToken: "t", businessId: "biz-a" });
    const out = await createBooking(input);
    expect(out).toMatchObject({ ok: true, reused: true, booking: { id: "bk" } });
    expect((out as { booking: Record<string, unknown> }).booking).not.toHaveProperty("businessId");
  });
});
