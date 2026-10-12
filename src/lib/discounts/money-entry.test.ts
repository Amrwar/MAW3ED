import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Money a person types is in pounds; money stored is in piastres.
 *
 * Found by creating a coupon through the dashboard: "50" under a label
 * reading "المبلغ بالجنيه" was stored as 50 piastres, so customers got
 * 0.50 EGP off and the booking summary said so. 12.50 was refused
 * outright, because the API takes whole piastres.
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("the offers form", () => {
  const source = read("src/app/dashboard/offers/_components/OffersClient.tsx");

  it("converts a fixed amount from pounds before sending it", () => {
    expect(source).toMatch(/value:\s*form\.kind === "FIXED" \? toCents\(form\.value\)/);
  });
});

describe("the booking response", () => {
  const source = read("src/app/api/public/[slug]/bookings/route.ts");

  // The done screen printed the list price as the total after a coupon.
  it("reports the stored total, not the service's list price", () => {
    const response = source.slice(source.indexOf("const bookingResponse"));
    expect(response).toMatch(/totalPrice:\s*Number\(booking\.totalPrice\)/);
    expect(response).not.toMatch(/totalPrice:\s*Number\(service\.price\)/);
  });
});
