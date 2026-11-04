import { describe, expect, it } from "vitest";
import { summarise } from "./operations";
import { seriesDates, MAX_OCCURRENCES } from "@/lib/bookings/series";
import { rebookHref } from "@/lib/bookings/rebook";

const row = (o: Partial<Parameters<typeof summarise>[0][number]> = {}) => ({
  status: "COMPLETED", totalPrice: 100, staffMemberId: "s1", resourceId: "t1", walkIn: false,
  partySize: 2, companions: 0, startTime: "10:00", endTime: "11:00", groupName: "أسنان", ...o,
});

describe("the operations report", () => {
  const staff = [{ id: "s1", nameAr: "سارة", commissionPercent: 30 }, { id: "s2", nameAr: "عمر", commissionPercent: null }];
  const resources = [{ id: "t1", name: "T1", area: "تراس", capacity: 4 }, { id: "t2", name: "T2", area: null, capacity: 2 }];

  it("adds up staff revenue and commission from completed visits only", () => {
    const r = summarise([row(), row({ status: "NO_SHOW" }), row({ status: "CANCELLED" }), row({ status: "CONFIRMED", staffMemberId: "s2" })], staff, resources, 1);
    expect(r.totals).toMatchObject({ booked: 3, completed: 1, cancelled: 1, noShows: 1, revenueCents: 10_000, noShowRate: 50 });
    expect(r.staff.find((s) => s.id === "s1")).toMatchObject({ booked: 2, completed: 1, noShows: 1, revenueCents: 10_000, commissionCents: 3_000 });
    expect(r.staff.find((s) => s.id === "s2")).toMatchObject({ booked: 1, commissionCents: 0 });
  });

  it("measures tables: guests, minutes, turns per day, by section", () => {
    const r = summarise([row(), row({ startTime: "12:00", endTime: "13:30", partySize: 3, companions: 1 }), row({ resourceId: "t2" })], staff, resources, 2);
    expect(r.resources.find((x) => x.id === "t1")).toMatchObject({ completed: 2, guests: 6, minutes: 150, turnsPerDay: 1 });
    expect(r.areas.map((a) => a.area).sort()).toEqual(["تراس", "—"].sort());
  });

  it("groups a clinic's visits by category and carries nobody's name or number", () => {
    const r = summarise([row(), row({ groupName: "جلدية" }), row({ groupName: null })], staff, resources, 1);
    expect(r.groups.map((g) => g.group).sort()).toEqual(["أسنان", "جلدية", "—"].sort());
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/customer|phone|01\d{9}/i);
  });

  it("counts walk-ins and ignores failed payments", () => {
    const r = summarise([row({ walkIn: true }), row({ status: "FAILED_PAYMENT" })], staff, resources, 1);
    expect(r.totals).toMatchObject({ booked: 1, walkIns: 1 });
  });
});

describe("recurring series", () => {
  it("steps by whole weeks and never past the bound", () => {
    expect(seriesDates("2026-11-02", 2, 3)).toEqual(["2026-11-02", "2026-11-16", "2026-11-30"]);
    expect(seriesDates("2026-11-02", 1, 500)).toHaveLength(MAX_OCCURRENCES);
    expect(seriesDates("2026-11-02", 99, 2)[1]).toBe("2026-11-30"); // interval capped at 4 weeks
    expect(seriesDates("2026-11-02", 1, -3)).toEqual([]);
  });
});

describe("book again", () => {
  it("pre-selects the service and the staff member, ids only", () => {
    expect(rebookHref("salon-x", "svc1", "st1")).toBe("/company/salon-x?service=svc1&staff=st1#booking");
    expect(rebookHref("salon-x", null)).toBe("/company/salon-x#booking");
  });
});
