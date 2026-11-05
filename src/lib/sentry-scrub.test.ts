import { describe, expect, it } from "vitest";
import { scrub } from "./sentry-shared";

/** URLs carrying bearer secrets are redacted before Sentry (final audit S-08). */
describe("scrub", () => {
  const t = "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6";
  it.each([
    [`https://www.maw3ed.net/booking/${t}`, "/booking/[token]"],
    [`https://www.maw3ed.net/api/public/booking/${t}/cancel`, "/booking/[token]/cancel"],
    [`https://www.maw3ed.net/en/pass/${t}`, "/pass/[token]"],
    [`https://www.maw3ed.net/booking-waitlist/${t}`, "/booking-waitlist/[token]"],
    [`https://www.maw3ed.net/c/${t}`, "/c/[token]"],
    [`https://www.maw3ed.net/reset-password?token=${t}&x=1`, "?token=[redacted]&x=1"],
  ])("redacts %s", (url, expected) => {
    const out = scrub(url);
    expect(out).toContain(expected);
    expect(out).not.toContain(t);
  });

  it("leaves ordinary paths alone", () => {
    expect(scrub("https://www.maw3ed.net/company/amr-hefny")).toBe("https://www.maw3ed.net/company/amr-hefny");
    expect(scrub("/api/business/bookings/clx123")).toBe("/api/business/bookings/clx123");
  });
});
