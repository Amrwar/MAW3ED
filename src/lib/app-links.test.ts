import { describe, it, expect } from "vitest";
import { androidAssetLinks, appleAppSiteAssociation, APP_LINK_PATHS } from "./app-links";

const FP = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0").toUpperCase()).join(":");

describe("apple-app-site-association", () => {
  it("is absent until the team is configured", () => {
    expect(appleAppSiteAssociation(undefined)).toBeNull();
    expect(appleAppSiteAssociation("  ")).toBeNull();
  });

  it("names the production app and only the paths it handles", () => {
    const body = appleAppSiteAssociation("ABCDE12345");
    expect(body?.applinks.details[0]?.appIDs).toEqual(["ABCDE12345.net.maw3ed.app"]);
    expect(body?.applinks.details[0]?.components).toEqual(APP_LINK_PATHS.map((path) => ({ "/": path })));
    expect(APP_LINK_PATHS).toEqual(expect.arrayContaining(["/company/*", "/booking/*", "/groups/*", "/venues/*", "/pass/*"]));
    // The business's front-desk page stays in the browser.
    expect(APP_LINK_PATHS.some((path) => path.startsWith("/c/"))).toBe(false);
  });
});

describe("assetlinks.json", () => {
  it("is absent until a fingerprint is configured", () => {
    expect(androidAssetLinks(undefined)).toBeNull();
    expect(androidAssetLinks("not-a-fingerprint")).toBeNull();
  });

  it("accepts several fingerprints and ignores malformed ones", () => {
    const body = androidAssetLinks(`${FP.toLowerCase()}, junk`);
    expect(body?.[0]?.target.sha256_cert_fingerprints).toEqual([FP]);
    expect(body?.[0]?.target.package_name).toBe("net.maw3ed.app");
  });
});

describe("the app's Android links", () => {
  it("claim exactly the paths iOS does (mobile/app.config.ts intent filters)", async () => {
    const { readFileSync } = await import("fs");
    const config = readFileSync("mobile/app.config.ts", "utf8");
    const android = [...(config.match(/\[("\/[^\]]*")\]\.map\(\(pathPrefix\)/)?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(android).toEqual(APP_LINK_PATHS.map((path) => path.replace(/\*$/, "")).sort());
  });
});
