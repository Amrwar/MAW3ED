import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SOURCES, sourceOf } from "./visit-source";

describe("a link's source", () => {
  it("matches the website's aliases exactly, so a link counts the same in the app and on the web", () => {
    const web = readFileSync(join(__dirname, "../../../src/lib/attribution/source.ts"), "utf8");
    const block = /const SRC_ALIASES[^{]*\{([\s\S]*?)\n\};/.exec(web)?.[1] ?? "";
    const aliases = Object.fromEntries([...block.matchAll(/^\s*([a-z0-9]+):\s*"([A-Z0-9_]+)"/gm)].map((m) => [m[1], m[2]]));
    expect(Object.keys(aliases).length).toBeGreaterThan(10);
    expect(SOURCES).toEqual(aliases);
  });

  it("is Maw3ed's own discovery without one, and OTHER when unrecognised", () => {
    expect(sourceOf(undefined)).toBe("MAW3ED");
    expect(sourceOf(" Card ")).toBe("QR");
    expect(sourceOf("tiktok")).toBe("OTHER");
  });
});
