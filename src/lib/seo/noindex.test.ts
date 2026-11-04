import { afterEach, describe, expect, it, vi } from "vitest";
import { siteNoindex } from "./noindex";

afterEach(() => vi.unstubAllEnvs());

describe("a test server keeps search engines out", () => {
  it("only SITE_NOINDEX=1 turns it on", () => {
    vi.stubEnv("SITE_NOINDEX", "1");
    expect(siteNoindex()).toBe(true);
    for (const v of ["", "true", "0"]) {
      vi.stubEnv("SITE_NOINDEX", v);
      expect(siteNoindex()).toBe(false);
    }
  });
});
