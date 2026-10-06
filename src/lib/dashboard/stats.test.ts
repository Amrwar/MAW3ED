import { describe, expect, it } from "vitest";

import { customerStats, newVsReturning, tally, type CountableBooking } from "./stats";

const NOW = new Date("2026-10-06T12:00:00Z");

function bk(p: Partial<CountableBooking> & { status: CountableBooking["status"] }): CountableBooking {
  const date = p.date ?? new Date("2026-10-06T00:00:00Z");
  return {
    status: p.status,
    totalPrice: p.totalPrice ?? 100,
    startsAt: p.startsAt ?? date,
    date,
    // `??` would swallow an explicit null, which is the walk-in case.
    customerId: "customerId" in p ? p.customerId ?? null : "c1",
    createdAt: p.createdAt ?? new Date("2026-10-01T00:00:00Z"),
  };
}

describe("tally", () => {
  it("counts nothing from nothing", () => {
    expect(tally([], NOW)).toEqual({
      completed: 0,
      cancelled: 0,
      noShows: 0,
      upcoming: 0,
      revenue: 0,
      total: 0,
    });
  });

  it("counts revenue from completed appointments only", () => {
    const t = tally(
      [
        bk({ status: "COMPLETED", totalPrice: 300 }),
        bk({ status: "CONFIRMED", totalPrice: 500, startsAt: new Date("2026-10-07T10:00:00Z") }),
        bk({ status: "CANCELLED", totalPrice: 900 }),
        bk({ status: "NO_SHOW", totalPrice: 700 }),
      ],
      NOW,
    );
    // The confirmed 500 is a booking, not money: it has not happened.
    expect(t.revenue).toBe(300);
    expect(t.completed).toBe(1);
    expect(t.cancelled).toBe(1);
    expect(t.noShows).toBe(1);
    expect(t.upcoming).toBe(1);
    expect(t.total).toBe(4);
  });

  it("ignores abandoned checkouts entirely", () => {
    // Somebody who opened a payment page and left never booked.
    const t = tally(
      [
        bk({ status: "PENDING_PAYMENT", totalPrice: 400 }),
        bk({ status: "FAILED_PAYMENT", totalPrice: 400 }),
        bk({ status: "COMPLETED", totalPrice: 100 }),
      ],
      NOW,
    );
    expect(t.total).toBe(1);
    expect(t.revenue).toBe(100);
  });

  it("does not call an appointment that has already started upcoming", () => {
    const t = tally(
      [
        bk({ status: "CONFIRMED", startsAt: new Date("2026-10-06T09:00:00Z") }),
        bk({ status: "CONFIRMED", startsAt: new Date("2026-10-06T15:00:00Z") }),
      ],
      NOW,
    );
    expect(t.upcoming).toBe(1);
  });

  it("counts an appointment being served right now as neither upcoming nor done", () => {
    const t = tally([bk({ status: "IN_PROGRESS", startsAt: new Date("2026-10-06T11:30:00Z") })], NOW);
    expect(t.upcoming).toBe(0);
    expect(t.completed).toBe(0);
    expect(t.total).toBe(1);
  });
});

describe("customerStats", () => {
  it("reports an unknown no-show rate for somebody never expected yet", () => {
    // Not 0% — nobody knows yet, and showing 0% would read as a record.
    const s = customerStats(
      [bk({ status: "CONFIRMED", startsAt: new Date("2026-10-08T10:00:00Z") })],
      NOW,
    );
    expect(s.noShowRate).toBeNull();
    expect(s.visits).toBe(0);
  });

  it("counts a missed appointment against attended ones, not against cancellations", () => {
    const s = customerStats(
      [
        bk({ status: "COMPLETED" }),
        bk({ status: "COMPLETED" }),
        bk({ status: "COMPLETED" }),
        bk({ status: "NO_SHOW" }),
        // Cancelling is telling the business; it is not a no-show.
        bk({ status: "CANCELLED" }),
        bk({ status: "CANCELLED" }),
      ],
      NOW,
    );
    expect(s.visits).toBe(3);
    expect(s.noShows).toBe(1);
    expect(s.cancelled).toBe(2);
    expect(s.noShowRate).toBeCloseTo(1 / 4);
  });

  it("finds the last visit and the next appointment", () => {
    const s = customerStats(
      [
        bk({ status: "COMPLETED", startsAt: new Date("2026-09-01T10:00:00Z") }),
        bk({ status: "COMPLETED", startsAt: new Date("2026-09-20T10:00:00Z") }),
        bk({ status: "CONFIRMED", startsAt: new Date("2026-11-01T10:00:00Z") }),
        bk({ status: "CONFIRMED", startsAt: new Date("2026-10-20T10:00:00Z") }),
      ],
      NOW,
    );
    expect(s.lastVisit?.toISOString()).toBe("2026-09-20T10:00:00.000Z");
    // The next one, not the last one booked.
    expect(s.nextVisit?.toISOString()).toBe("2026-10-20T10:00:00.000Z");
  });

  it("does not treat a past confirmed booking as a next visit", () => {
    const s = customerStats(
      [bk({ status: "CONFIRMED", startsAt: new Date("2026-10-01T10:00:00Z") })],
      NOW,
    );
    expect(s.nextVisit).toBeNull();
  });

  it("takes first seen from when they booked, not when they came", () => {
    const s = customerStats(
      [
        bk({
          status: "COMPLETED",
          createdAt: new Date("2026-08-01T00:00:00Z"),
          startsAt: new Date("2026-09-01T10:00:00Z"),
        }),
      ],
      NOW,
    );
    expect(s.firstSeen?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });
});

describe("newVsReturning", () => {
  const periodStart = new Date("2026-10-01T00:00:00Z");

  it("counts a person once however many times they came", () => {
    const rows = [
      bk({ status: "COMPLETED", customerId: "a", createdAt: new Date("2026-10-02T00:00:00Z") }),
      bk({ status: "COMPLETED", customerId: "a", createdAt: new Date("2026-10-03T00:00:00Z") }),
      bk({ status: "COMPLETED", customerId: "a", createdAt: new Date("2026-10-04T00:00:00Z") }),
    ];
    expect(newVsReturning(rows, periodStart)).toEqual({ newCustomers: 1, returning: 0 });
  });

  it("calls somebody returning when they had booked before the period", () => {
    const rows = [
      bk({ status: "COMPLETED", customerId: "a", createdAt: new Date("2026-05-01T00:00:00Z") }),
      bk({ status: "COMPLETED", customerId: "a", createdAt: new Date("2026-10-02T00:00:00Z") }),
      bk({ status: "COMPLETED", customerId: "b", createdAt: new Date("2026-10-02T00:00:00Z") }),
    ];
    expect(newVsReturning(rows, periodStart)).toEqual({ newCustomers: 1, returning: 1 });
  });

  it("counts nobody who did not book in the period", () => {
    const rows = [
      bk({ status: "COMPLETED", customerId: "a", createdAt: new Date("2026-05-01T00:00:00Z") }),
    ];
    expect(newVsReturning(rows, periodStart)).toEqual({ newCustomers: 0, returning: 0 });
  });

  it("ignores a walk-in with no customer record", () => {
    const rows = [
      bk({ status: "COMPLETED", customerId: null, createdAt: new Date("2026-10-02T00:00:00Z") }),
    ];
    expect(newVsReturning(rows, periodStart)).toEqual({ newCustomers: 0, returning: 0 });
  });

  it("does not count an abandoned checkout as a new customer", () => {
    const rows = [
      bk({ status: "PENDING_PAYMENT", customerId: "a", createdAt: new Date("2026-10-02T00:00:00Z") }),
    ];
    expect(newVsReturning(rows, periodStart)).toEqual({ newCustomers: 0, returning: 0 });
  });
});
