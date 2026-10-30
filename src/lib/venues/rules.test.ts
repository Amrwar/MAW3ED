import { describe, it, expect } from "vitest";
import {
  accessWindow,
  venueFaq,
  isOpenAt,
  locationPath,
  directionsUrl,
  policySchema,
  exceptionSchema,
  venueHoursSchema,
  type AccessPolicy,
} from "./rules";
import { venueSeo } from "./seo";
import { filterDirectory, directoryCategories, type DirectoryEntry } from "./public";

const policy = (p: Partial<AccessPolicy> = {}): AccessPolicy => ({
  visitorEligibility: "BOOKING_REQUIRED",
  accessBeforeMinutes: 30,
  accessAfterMinutes: 15,
  maxGuestsPerBooking: 2,
  reentryAllowed: false,
  ...p,
});

describe("accessWindow", () => {
  const b = { startsAt: new Date("2026-11-01T10:00:00Z"), endsAt: new Date("2026-11-01T11:00:00Z"), status: "CONFIRMED", partySize: 5 };
  it("opens before and closes after the booking, and caps guests", () => {
    expect(accessWindow(b, policy())).toEqual({
      from: new Date("2026-11-01T09:30:00Z"),
      until: new Date("2026-11-01T11:15:00Z"),
      people: 3,
      reentry: false,
    });
  });
  it("gives nothing when bookings do not grant access, or the booking is not live", () => {
    expect(accessWindow(b, policy({ visitorEligibility: "OPEN" }))).toBeNull();
    expect(accessWindow(b, policy({ visitorEligibility: "OPERATOR_MANAGED" }))).toBeNull();
    expect(accessWindow({ ...b, status: "PENDING" }, policy())).toBeNull();
    expect(accessWindow({ ...b, status: "CANCELLED" }, policy())).toBeNull();
  });
});

describe("venueFaq", () => {
  const v = { nameAr: "مول تجريبي", nameEn: "Sample Mall" };
  it("answers only from the configured policy and never promises a pass", () => {
    const en = venueFaq(v, policy(), "en");
    const text = en.map((f) => f.a).join(" ");
    expect(text).toMatch(/not an entry pass/);
    expect(text).toMatch(/30 minutes before/);
    expect(text).toMatch(/Up to 2 guest/);
    expect(text).not.toMatch(/Emaar|official|authori[sz]ed|partner/i);
  });
  it("is short when there is no policy, and in Arabic when asked", () => {
    expect(venueFaq(v, null, "ar")).toHaveLength(1);
    expect(venueFaq(v, policy({ visitorEligibility: "CLOSED_TO_VISITORS" }), "ar")[1].a).toMatch(/مش مفتوح/);
  });
});

describe("isOpenAt", () => {
  const hours = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "10:00", closeTime: "02:00", isClosed: d === 5 }));
  it("handles overnight hours and closed days", () => {
    expect(isOpenAt(hours, 1, 11 * 60)).toBe(true);
    expect(isOpenAt(hours, 1, 9 * 60)).toBe(false);
    // 01:00 on Tuesday is still Monday night.
    expect(isOpenAt(hours, 2, 60)).toBe(true);
    expect(isOpenAt(hours, 5, 12 * 60)).toBe(false);
    // Saturday 01:00 follows a closed Friday.
    expect(isOpenAt(hours, 6, 60)).toBe(false);
  });
});

describe("locationPath", () => {
  const city = { nameAr: "القاهرة الجديدة", nameEn: "New Cairo", slug: "new-cairo" };
  it("runs country → city → district → compound → venue → zone → branch", () => {
    const p = locationPath({
      countryCode: "EG",
      city,
      district: { nameAr: "التجمع", nameEn: "Tagamoa", slug: "tagamoa" },
      compound: { nameAr: "كمبوند", nameEn: null, slug: "c" },
      venue: { nameAr: "مول", nameEn: null, slug: "m" },
      zone: { nameAr: "الدور الأول", nameEn: "First floor" },
      branch: { nameAr: "فرع", nameEn: null },
    });
    expect(p.map((n) => n.level)).toEqual(["country", "city", "district", "compound", "venue", "zone", "branch"]);
    expect(p[0]).toMatchObject({ nameAr: "مصر", nameEn: "Egypt" });
  });
  it("leaves out levels a business outside any venue does not have", () => {
    expect(locationPath({ countryCode: "EG", city }).map((n) => n.level)).toEqual(["country", "city"]);
  });
});

describe("input rules", () => {
  it("validates the policy ranges", () => {
    const ok = { visitorEligibility: "OPEN", accessBeforeMinutes: 0, accessAfterMinutes: 720, maxGuestsPerBooking: 50, reentryAllowed: true, allowedGateIds: [], accessInstructionsAr: "", accessInstructionsEn: null };
    expect(policySchema.safeParse(ok).success).toBe(true);
    expect(policySchema.safeParse({ ...ok, maxGuestsPerBooking: 51 }).success).toBe(false);
    expect(policySchema.safeParse({ ...ok, visitorEligibility: "VIP" }).success).toBe(false);
  });
  it("refuses an exception ending before it starts, and special hours without times", () => {
    expect(exceptionSchema.safeParse({ kind: "CLOSED", startsOn: "2026-11-02", endsOn: "2026-11-01" }).success).toBe(false);
    expect(exceptionSchema.safeParse({ kind: "SPECIAL_HOURS", startsOn: "2026-11-02", endsOn: "2026-11-02" }).success).toBe(false);
    expect(exceptionSchema.safeParse({ kind: "SPECIAL_HOURS", startsOn: "2026-11-02", endsOn: "2026-11-02", openTime: "12:00", closeTime: "18:00" }).success).toBe(true);
  });
  it("needs each day of the week exactly once", () => {
    const week = [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, openTime: "10:00", closeTime: "22:00", isClosed: false }));
    expect(venueHoursSchema.safeParse(week).success).toBe(true);
    expect(venueHoursSchema.safeParse([...week.slice(0, 6), { ...week[0] }]).success).toBe(false);
  });
});

describe("public page helpers", () => {
  const e = (n: string, cat: string, zone: string | null): DirectoryEntry => ({
    membershipId: n, slug: n, nameAr: n, nameEn: n.toUpperCase(), logoImage: null, ratingAvg: 0, ratingCount: 0, isVerified: false,
    category: { slug: cat, nameAr: cat, nameEn: cat }, zone: zone ? { id: zone, nameAr: zone, nameEn: null, level: null } : null, unit: null, branch: null,
  });
  const dir = [e("cafe1", "cafes", "z1"), e("clinic1", "clinics", "z2"), e("cafe2", "cafes", "z2")];
  it("filters by category, zone and text, and counts categories", () => {
    expect(filterDirectory(dir, { category: "cafes" }).map((x) => x.slug)).toEqual(["cafe1", "cafe2"]);
    expect(filterDirectory(dir, { zone: "z2" }).map((x) => x.slug)).toEqual(["clinic1", "cafe2"]);
    expect(filterDirectory(dir, { q: "CLINIC" }).map((x) => x.slug)).toEqual(["clinic1"]);
    expect(filterDirectory(dir, {})).toHaveLength(3);
    expect(directoryCategories(dir)).toEqual([
      { slug: "cafes", nameAr: "cafes", nameEn: "cafes", count: 2 },
      { slug: "clinics", nameAr: "clinics", nameEn: "clinics", count: 1 },
    ]);
  });
  it("writes Arabic and English metadata, and does not index an empty venue", () => {
    const v = { slug: "sample-mall", kind: "MALL", nameAr: "مول تجريبي", nameEn: "Sample Mall", city: { nameAr: "القاهرة", nameEn: "Cairo" }, directory: dir };
    const ar = venueSeo(v, "ar");
    const en = venueSeo(v, "en");
    expect(ar).toMatchObject({ path: "/venues/sample-mall", index: true });
    expect(ar.title).toMatch(/مول تجريبي/);
    expect(en.title).toMatch(/Sample Mall/);
    expect(en.description).toMatch(/3 places inside Sample Mall, a mall in Cairo/);
    expect(venueSeo({ ...v, directory: [] }, "en").index).toBe(false);
  });
  it("builds directions from a pin, or from the name", () => {
    expect(directionsUrl({ latitude: 30.1, longitude: 31.4, label: "x" })).toMatch(/destination=30\.1%2C31\.4/);
    expect(directionsUrl({ latitude: null, longitude: null, label: "Sample Mall" })).toMatch(/destination=Sample%20Mall/);
  });
});
