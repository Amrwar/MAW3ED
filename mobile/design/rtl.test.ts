import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * RTL is structural: the locale sets the layout direction once, and
 * everything uses start/end so it follows. One `marginLeft` anywhere is
 * a screen that is right in one language and wrong in the other — and
 * nobody notices until an Arabic user does. This fails on the first.
 *
 * And no colour outside the tokens: the palette is the web's, checked
 * by tokens.test.ts, and a hex literal in a screen bypasses both.
 */

const ROOT = join(__dirname, "..");
const SCANNED = ["app", "features", "design", "components"];

function files(dir: string, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const sources = SCANNED.flatMap((d) => files(join(ROOT, d))).map((f) => ({
  file: relative(ROOT, f).replace(/\\/g, "/"),
  // Comments may talk about left and right; code may not.
  code: readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
}));

describe("structural RTL", () => {
  it("found the source", () => {
    expect(sources.length).toBeGreaterThan(30);
  });

  it("uses start/end, never left/right, for spacing, borders and position", () => {
    const physical = /\b(?:margin|padding|border)(?:Left|Right)\w*\s*:|\b(?:left|right)\s*:\s*[\d-]/;
    const offenders = sources.filter((s) => physical.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it("never hard-codes a text alignment to one side", () => {
    const fixed = /textAlign:\s*["'](?:left|right)["']/;
    const offenders = sources.filter((s) => fixed.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  // Forcing LTR on a line of Arabic scrambles it — "ص 10:30 – ص 10:00"
  // for "10:00 ص – 10:30 ص". Numbers already read correctly inside an
  // RTL line; direction comes from the locale (Text) or is computed.
  it("never forces a writing direction with a literal", () => {
    const forced = /writingDirection:\s*["'](?:ltr|rtl)["']/;
    const offenders = sources.filter((s) => forced.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });

  it("does not flip layout by hand with I18nManager", () => {
    const offenders = sources.filter((s) => /I18nManager/.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });
});

describe("colour comes from the tokens", () => {
  it("has no hex or rgb colour outside design/tokens.ts", () => {
    const literal = /["']#[0-9A-Fa-f]{3,8}["']|rgba?\(/;
    const offenders = sources.filter((s) => s.file !== "design/tokens.ts" && literal.test(s.code)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });
});
