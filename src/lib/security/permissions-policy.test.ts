import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * The Permissions-Policy header must allow what the site's own pages use.
 *
 * `camera=()` once refused the camera on every page, so the check-in
 * desk's QR scanner (getUserMedia) failed before the browser could ask
 * the staff member, and scanning never worked in production (final
 * audit F-02). The header is read from next.config.ts as text: importing
 * it would pull in the Sentry build wrapper.
 */

const root = join(__dirname, "..", "..", "..");
const config = readFileSync(join(root, "next.config.ts"), "utf8");
const policy = /key: "Permissions-Policy",\s*value: "([^"]+)"/.exec(config)?.[1] ?? "";
const allow = (feature: string) => new RegExp(`(^|, )${feature}=\\(([^)]*)\\)`).exec(policy)?.[2];

describe("Permissions-Policy", () => {
  it("is set", () => {
    expect(policy).not.toBe("");
  });

  it("lets this site's pages use the camera, because the check-in desk scans with it", () => {
    const desk = readFileSync(join(root, "src", "components", "access", "CheckInDesk.tsx"), "utf8");
    expect(desk).toContain("getUserMedia");
    expect(allow("camera")).toBe("self");
  });

  it("still refuses what nothing uses", () => {
    expect(allow("microphone")).toBe("");
    expect(allow("payment")).toBe("");
    expect(allow("usb")).toBe("");
  });
});
