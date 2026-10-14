import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { colors, tones } from "./tokens";

/** WCAG 2 relative luminance contrast. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe("text contrast", () => {
  // Every pairing a component actually draws text in. 4.5:1 is WCAG AA
  // for body text; nothing in the app relies on the large-text 3:1.
  const pairs: [string, keyof typeof colors, keyof typeof colors][] = [
    ["ink on ground", "ink", "ground"],
    ["ink2 on surface", "ink2", "surface"],
    ["muted on surface", "muted", "surface"],
    ["subtle on surface", "subtle", "surface"],
    ["subtle on ground", "subtle", "ground"],
    ["subtle on surface2", "subtle", "surface2"],
    ["white on jade (primary button)", "inverse", "jade"],
    ["white on ink (secondary button)", "inverse", "ink"],
    ["white on danger (danger button)", "inverse", "danger"],
    ["white on night", "inverse", "night"],
    ["nightText on night", "nightText", "night"],
    ["nightText on night2", "nightText", "night2"],
    ["jade on surface (ghost button, links)", "jade", "surface"],
    ["jade on jadeSoft (avatar initials)", "jade", "jadeSoft"],
    ["jade on jadeTint (selected card)", "jade", "jadeTint"],
    ["jadeSoft on jade (selected chip count)", "jadeSoft", "jade"],
    ["muted on ground", "muted", "ground"],
    ["gold on night (highlights)", "gold", "night"],
    ["night on gold (gold buttons)", "night", "gold"],
    ["nightText on nightLine-free night2 cards", "nightText", "night2"],
    ["night on goldSoft (gold badges)", "night", "goldSoft"],
    ["ink2 on goldSoft (booking row end time)", "ink2", "goldSoft"],
  ];

  it.each(pairs)("%s reaches 4.5:1", (_, fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(Object.entries(tones))("the %s tone's text reads on its own fill", (_, t) => {
    expect(contrast(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("the gold used for icons on night reaches 3:1, the non-text minimum", () => {
    expect(contrast(colors.nightAccent, colors.night)).toBeGreaterThanOrEqual(3);
  });
});

describe("the palette is the web's", () => {
  // No arbitrary colours: every app token with a web counterpart has its
  // value. The web is the source; when it changes, this fails until the
  // app follows.
  const css = readFileSync(join(__dirname, "../../src/app/globals.css"), "utf8");
  const web = new Map([...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1]!, m[2]!.toUpperCase()]));
  const kebab = (name: string) => name.replace(/([a-z])([A-Z0-9])/g, "$1-$2").toLowerCase();

  // The app's own brand layer (the Bold Cairo redesign): its ground,
  // night and gold. Everything else still has to match the web.
  const appOnly = new Set([
    "scrim",
    "ground",
    "night",
    "night2",
    "nightLine",
    "nightText",
    "nightSubtle",
    "nightAccent",
    "nightOk",
    "gold",
    "goldSoft",
    "goldLine",
    "mapLand",
    "mapWater",
    "mapPark",
  ]);

  it.each(Object.entries(colors).filter(([k]) => !appOnly.has(k)))("%s matches globals.css", (name, value) => {
    expect(web.get(kebab(name)), `--color-${kebab(name)}`).toBe(value.toUpperCase());
  });
});
