import { describe, it, expect } from "vitest";
import { ourPath, routeFor } from "./links";

describe("ourPath", () => {
  it("reads our https links, with and without www", () => {
    expect(ourPath("https://www.maw3ed.net/company/qa-salon?src=qr")).toBe("/company/qa-salon");
    expect(ourPath("https://maw3ed.net/booking/abc#review")).toBe("/booking/abc");
  });

  it("reads the app scheme, whose first segment parses as a host", () => {
    expect(ourPath("maw3ed://dashboard/bookings")).toBe("/dashboard/bookings");
    expect(ourPath("maw3ed:///account")).toBe("/account");
  });

  it("refuses somebody else's link, and plain http", () => {
    expect(ourPath("https://evil.example/company/x")).toBeNull();
    expect(ourPath("https://maw3ed.net.evil.example/company/x")).toBeNull();
    expect(ourPath("http://www.maw3ed.net/company/x")).toBeNull();
    expect(ourPath("javascript:alert(1)")).toBeNull();
  });
});

describe("routeFor", () => {
  it("sends the notification links the server writes to the right tab", () => {
    // src/lib/notifications/recipients.ts
    expect(routeFor("/dashboard/bookings")).toBe("/(business)/calendar");
    expect(routeFor("/dashboard/settings")).toBe("/(business)/account");
    // Too short to be a token: the nearest screen, not a broken one.
    expect(routeFor("/booking/0123abcd")).toBe("/(customer)/bookings");
    const token = "a".repeat(64);
    expect(routeFor(`https://maw3ed.net/booking/${token}`)).toBe(`/booking/${token}`);
    expect(routeFor(`/booking/${token}/../x`)).toBe("/(customer)/bookings");
    expect(routeFor("/account")).toBe("/(customer)/account");
  });

  it("opens a business link on the business screen", () => {
    expect(routeFor("https://www.maw3ed.net/company/qa-salon?src=qr")).toBe("/business/qa-salon");
    expect(routeFor("maw3ed://company/qa-salon")).toBe("/business/qa-salon");
    // slugify() keeps underscores (src/lib/utils.ts).
    expect(routeFor("https://maw3ed.net/company/qa_salon")).toBe("/business/qa_salon");
  });

  it("never passes a malformed slug into a route", () => {
    expect(routeFor("/company/../admin")).toBe("/(customer)/search");
    expect(routeFor("/company/QA%20x")).toBe("/(customer)/search");
    expect(routeFor("/company")).toBe("/(customer)/search");
  });

  it("matches whole segments only", () => {
    expect(routeFor("/accounting")).toBe("/");
    expect(routeFor("/dashboardx")).toBe("/");
  });

  it("falls back to home rather than a not-found screen", () => {
    expect(routeFor("/pricing")).toBe("/");
    expect(routeFor("https://elsewhere.example/dashboard")).toBe("/");
    expect(routeFor("")).toBe("/");
  });

  it("ignores trailing slashes and query strings", () => {
    expect(routeFor("/dashboard/calendar/?view=week")).toBe("/(business)/calendar");
  });
});
