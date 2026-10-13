import { describe, expect, it } from "vitest";
import { boundingBox, distanceKm, isShortMapsLink, parseLocation, validLatLng } from "./geo";

describe("reading a pasted location", () => {
  it("takes the place's own pin from a full Google Maps link over the map centre", () => {
    const url =
      "https://www.google.com/maps/place/Cairo+Tower/@30.0459751,31.2242802,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d30.0459715!4d31.2242554";
    expect(parseLocation(url)).toEqual({ lat: 30.045972, lng: 31.224255 });
  });

  it("reads the centre of a map link, a q= link and plain coordinates", () => {
    expect(parseLocation("https://www.google.com/maps/@30.0444,31.2357,15z")).toEqual({ lat: 30.0444, lng: 31.2357 });
    expect(parseLocation("https://maps.google.com/?q=30.0444,31.2357")).toEqual({ lat: 30.0444, lng: 31.2357 });
    expect(parseLocation("30.0444, 31.2357")).toEqual({ lat: 30.0444, lng: 31.2357 });
    expect(parseLocation("30.0444،31.2357")).toEqual({ lat: 30.0444, lng: 31.2357 });
  });

  it("refuses anything without coordinates, out of range, or 0,0", () => {
    expect(parseLocation("4 Tahrir St, Cairo")).toBeNull();
    expect(parseLocation("95, 31")).toBeNull();
    expect(parseLocation("0, 0")).toBeNull();
    expect(parseLocation("")).toBeNull();
  });

  it("knows a short link has to be opened first", () => {
    expect(isShortMapsLink("https://maps.app.goo.gl/abc123")).toBe(true);
    expect(isShortMapsLink("https://www.google.com/maps/@30,31,15z")).toBe(false);
  });

  it("validates ranges", () => {
    expect(validLatLng(30, 31)).toBe(true);
    expect(validLatLng(-91, 31)).toBe(false);
    expect(validLatLng(30, 181)).toBe(false);
    expect(validLatLng(Number.NaN, 31)).toBe(false);
  });
});

describe("distance", () => {
  it("measures Cairo to Alexandria at about 180 km", () => {
    const d = distanceKm({ lat: 30.0444, lng: 31.2357 }, { lat: 31.2001, lng: 29.9187 });
    expect(d).toBeGreaterThan(175);
    expect(d).toBeLessThan(185);
  });

  it("boxes every point within the radius", () => {
    const c = { lat: 30.0444, lng: 31.2357 };
    const box = boundingBox(c, 5);
    const east = { lat: c.lat, lng: box.maxLng };
    expect(distanceKm(c, east)).toBeGreaterThanOrEqual(4.99);
    expect(distanceKm(c, { lat: box.maxLat, lng: c.lng })).toBeGreaterThanOrEqual(4.99);
  });
});
