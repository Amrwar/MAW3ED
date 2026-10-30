import { describe, it, expect } from "vitest";
import { computeReadiness, longestOpenWindow, type ReadinessFacts } from "./readiness";

const open = (openTime = "09:00", closeTime = "17:00") =>
  [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime, closeTime, isClosed: false }));

function ready(over: Partial<ReadinessFacts> = {}): ReadinessFacts {
  return {
    businessType: "GENERAL",
    hasCategory: true,
    phone: "01012345678",
    address: "شارع ١",
    hasLocation: false,
    logoImage: null,
    about: null,
    emailVerified: true,
    phoneVerified: false,
    services: [{ duration: 30, price: 100 }],
    hours: open(),
    activeStaff: 0,
    activeResources: 0,
    depositEnabled: false,
    depositsAllowed: false,
    policiesReviewed: true,
    notificationReachable: true,
    isPublished: false,
    testBookings: 0,
    ...over,
  };
}

describe("computeReadiness", () => {
  it("lets a business publish with every required item and no recommended ones", () => {
    const r = computeReadiness(ready());
    expect(r.canPublish).toBe(true);
    expect(r.missing).toEqual([]);
    expect(r.percent).toBeLessThan(100);
  });

  it("blocks publishing on each required item on its own", () => {
    const cases: [Partial<ReadinessFacts>, string][] = [
      [{ hasCategory: false }, "category"],
      [{ phone: "123" }, "phone"],
      [{ emailVerified: false }, "email"],
      [{ address: "  " }, "address"],
      [{ hours: open().map((h) => ({ ...h, isClosed: true })) }, "hours"],
      [{ services: [] }, "services"],
      [{ services: [{ duration: 2, price: 10 }] }, "services"],
      [{ services: [{ duration: 30, price: -5 }] }, "prices"],
      [{ policiesReviewed: false }, "policies"],
    ];
    for (const [over, key] of cases) {
      const r = computeReadiness(ready(over));
      expect(r.canPublish, key).toBe(false);
      expect(r.missing, key).toContain(key);
    }
  });

  it("requires a day long enough for the shortest service", () => {
    const r = computeReadiness(ready({ hours: open("09:00", "09:20"), services: [{ duration: 30, price: 1 }] }));
    expect(r.missing).toContain("hours");
    expect(r.items.find((i) => i.key === "hours")?.whyEn).toMatch(/long enough/);
  });

  it("counts overnight hours", () => {
    expect(longestOpenWindow(open("20:00", "02:00"))).toBe(6 * 60);
  });

  it("refuses deposits the plan does not include, or on all-free services", () => {
    expect(computeReadiness(ready({ depositEnabled: true, depositsAllowed: false })).missing).toContain("prices");
    expect(
      computeReadiness(ready({ depositEnabled: true, depositsAllowed: true, services: [{ duration: 30, price: 0 }] })).missing,
    ).toContain("prices");
    expect(computeReadiness(ready({ depositEnabled: true, depositsAllowed: true })).canPublish).toBe(true);
  });

  it("asks each kind of business only for what it uses", () => {
    const keys = (t: ReadinessFacts["businessType"]) => computeReadiness(ready({ businessType: t })).items.map((i) => i.key);
    expect(keys("BARBERSHOP")).toContain("team");
    expect(keys("BARBERSHOP")).not.toContain("tables");
    expect(keys("RESTAURANT")).toContain("tables");
    expect(keys("RESTAURANT")).not.toContain("team");
    expect(keys("GENERAL")).not.toContain("team");
  });

  it("never blocks on recommended items", () => {
    const r = computeReadiness(ready({ businessType: "BARBERSHOP", activeStaff: 0, hasLocation: false, notificationReachable: false }));
    expect(r.canPublish).toBe(true);
  });

  it("reaches 100% when everything is done", () => {
    const r = computeReadiness(
      ready({ hasLocation: true, phoneVerified: true, logoImage: "x", about: "y", testBookings: 1 }),
    );
    expect(r.percent).toBe(100);
  });
});
