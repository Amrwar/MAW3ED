import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { computeAnalytics, granularityFor, mondayOf, parseDay, thisCairoMonth, type AnalyticsRow } from "./analytics";

const row = (over: Partial<AnalyticsRow>): AnalyticsRow => ({
  date: parseDay("2026-10-05"),
  startTime: "10:00",
  status: "COMPLETED",
  totalPrice: 100,
  currency: "EGP",
  customerId: "c1",
  serviceId: "s1",
  serviceNameAr: "قص شعر",
  serviceNameEn: "Haircut",
  ...over,
});
const OCT = { from: parseDay("2026-10-01"), to: parseDay("2026-10-31") };

describe("computeAnalytics", () => {
  it("never counts abandoned checkouts or cancellations", () => {
    const out = computeAnalytics(
      [
        row({}),
        row({ status: "PENDING_PAYMENT", totalPrice: 999 }),
        row({ status: "FAILED_PAYMENT", totalPrice: 999 }),
        row({ status: "CANCELLED", totalPrice: 999 }),
        row({ status: "CONFIRMED", totalPrice: 50 }),
      ],
      OCT,
      new Set(),
    );
    expect(out.kpis.totalBookings).toBe(2);
    expect(out.kpis.completedRevenue).toBe(100);
    expect(out.kpis.avgBookingValue).toBe(100);
    expect(out.bookingsByService[0].bookings).toBe(2);
    expect(out.heatmap.reduce((s, h) => s + h.count, 0)).toBe(2);
  });

  it("says 'no data' (null), not 0, when there is nothing to divide", () => {
    const out = computeAnalytics([row({ status: "CONFIRMED", customerId: null })], OCT, new Set());
    expect(out.kpis.avgBookingValue).toBeNull();
    expect(out.kpis.repeatCustomerRate).toBeNull();
    const empty = computeAnalytics([], OCT, new Set());
    expect(empty.kpis.totalBookings).toBe(0);
    expect(empty.kpis.repeatCustomerRate).toBeNull();
  });

  it("repeat rate is the share of this period's customers who are repeaters", () => {
    const out = computeAnalytics(
      [row({ customerId: "a" }), row({ customerId: "b" }), row({ customerId: "b" }), row({ customerId: "c" }), row({ customerId: "d" })],
      OCT,
      new Set(["b", "z"]),
    );
    expect(out.kpis.repeatCustomerRate).toBe(0.25);
  });

  it("fills every day of a month and puts each booking on its own day", () => {
    const out = computeAnalytics([row({ date: parseDay("2026-10-31") })], OCT, new Set());
    expect(out.granularity).toBe("day");
    expect(out.revenueByPeriod).toHaveLength(31);
    expect(out.revenueByPeriod[30]).toMatchObject({ bookings: 1, revenue: 100 });
  });

  it("weeks start on Monday and every booking lands in a week", () => {
    const range = { from: parseDay("2026-08-06"), to: parseDay("2026-10-31") }; // a Thursday
    const rows = [row({ date: parseDay("2026-08-06") }), row({ date: parseDay("2026-10-31") }), row({ date: parseDay("2026-09-14") })];
    const out = computeAnalytics(rows, range, new Set());
    expect(out.granularity).toBe("week");
    expect(out.revenueByPeriod.reduce((s, p) => s + p.bookings, 0)).toBe(3);
  });

  it("months over a long range, labelled in the page's language", () => {
    const range = { from: parseDay("2026-01-15"), to: parseDay("2026-10-31") };
    const out = computeAnalytics([row({ date: parseDay("2026-01-20") })], range, new Set(), "en");
    expect(out.granularity).toBe("month");
    expect(out.revenueByPeriod).toHaveLength(10);
    expect(out.revenueByPeriod[0]).toMatchObject({ period: "Jan", bookings: 1 });
    expect(out.bookingsByService[0].serviceName).toBe("Haircut");
  });

  it("flags mixed currencies instead of pretending one sum is meaningful", () => {
    const out = computeAnalytics([row({}), row({ currency: "USD" })], OCT, new Set());
    expect(out.kpis.mixedCurrency).toBe(true);
  });
});

describe("calendar helpers", () => {
  it("mondayOf", () => {
    expect(mondayOf(parseDay("2026-11-04")).toISOString().slice(0, 10)).toBe("2026-11-02"); // Wednesday
    expect(mondayOf(parseDay("2026-11-08")).toISOString().slice(0, 10)).toBe("2026-11-02"); // Sunday
    expect(mondayOf(parseDay("2026-11-02")).toISOString().slice(0, 10)).toBe("2026-11-02");
  });
  it("granularity bounds", () => {
    expect(granularityFor(parseDay("2026-10-01"), parseDay("2026-10-31"))).toBe("day");
    expect(granularityFor(parseDay("2026-08-01"), parseDay("2026-10-31"))).toBe("week");
    expect(granularityFor(parseDay("2026-01-01"), parseDay("2026-10-31"))).toBe("month");
  });
  it("this month is Cairo's: 23:30 UTC on Oct 31 is already Nov 1 in Cairo", () => {
    expect(thisCairoMonth(new Date("2026-10-31T23:30:00Z"))).toEqual({ from: "2026-11-01", to: "2026-11-01" });
  });
});
