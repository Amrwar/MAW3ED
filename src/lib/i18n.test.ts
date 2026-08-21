/**
 * Translation parity.
 *
 * The site serves Arabic and English from one object, and a key added to
 * one side and forgotten on the other renders as `undefined` rather than
 * as an error. These walk both trees and compare them.
 */

import { describe, expect, it } from "vitest";

import { translations, type Lang } from "./i18n";

const LANGS: Lang[] = ["ar", "en"];

/**
 * Every leaf path in a nested object, as dotted keys.
 *
 * Arrays are walked by index rather than treated as leaves: several
 * sections (the contact channels, the FAQ items) are lists of objects, and
 * a language with one fewer entry than the other is exactly the kind of
 * drift worth catching.
 */
function leafPaths(node: unknown, prefix = ""): string[] {
  if (node === null || typeof node !== "object") {
    return [prefix];
  }
  const entries = Array.isArray(node)
    ? node.map((value, index) => [String(index), value] as const)
    : Object.entries(node as Record<string, unknown>);
  const out: string[] = [];
  for (const [key, value] of entries) {
    out.push(...leafPaths(value, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

/** The value at a dotted path. */
function valueAt(node: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (current, key) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[key]
          : undefined,
      node,
    );
}

const arKeys = leafPaths(translations.ar).sort();
const enKeys = leafPaths(translations.en).sort();

describe("the bundles", () => {
  it("serve both languages", () => {
    for (const lang of LANGS) {
      expect(translations[lang]).toBeDefined();
    }
  });

  it("serve only the languages the type allows", () => {
    expect(Object.keys(translations).sort()).toEqual([...LANGS].sort());
  });

  it("declare their own language code", () => {
    expect(translations.ar.lang).toBe("ar");
    expect(translations.en.lang).toBe("en");
  });

  it("declare a text direction each", () => {
    expect(translations.ar.dir).toBe("rtl");
    expect(translations.en.dir).toBe("ltr");
  });

  it("carry a meaningful number of strings", () => {
    expect(arKeys.length).toBeGreaterThan(100);
  });
});

describe("key parity", () => {
  it("gives English every key Arabic has", () => {
    const missing = arKeys.filter((key) => !enKeys.includes(key));
    expect(missing).toEqual([]);
  });

  it("gives Arabic every key English has", () => {
    const missing = enKeys.filter((key) => !arKeys.includes(key));
    expect(missing).toEqual([]);
  });

  it("holds the same number of strings on both sides", () => {
    expect(enKeys.length).toBe(arKeys.length);
  });

  it("repeats no key within a bundle", () => {
    expect(new Set(arKeys).size).toBe(arKeys.length);
    expect(new Set(enKeys).size).toBe(enKeys.length);
  });
});

describe("every string", () => {
  it("is a string on both sides, never an object on one", () => {
    for (const key of arKeys) {
      expect(typeof valueAt(translations.ar, key), `ar.${key}`).toBe("string");
      expect(typeof valueAt(translations.en, key), `en.${key}`).toBe("string");
    }
  });

  it("is non-empty on both sides", () => {
    for (const key of arKeys) {
      expect(String(valueAt(translations.ar, key)).trim().length, `ar.${key}`)
        .toBeGreaterThan(0);
      expect(String(valueAt(translations.en, key)).trim().length, `en.${key}`)
        .toBeGreaterThan(0);
    }
  });

  it("carries no untrimmed padding, which shows up in the markup", () => {
    for (const key of arKeys) {
      const ar = String(valueAt(translations.ar, key));
      const en = String(valueAt(translations.en, key));
      expect(ar, `ar.${key}`).toBe(ar.trim());
      expect(en, `en.${key}`).toBe(en.trim());
    }
  });
});

describe("placeholder parity", () => {
  /** `{name}`-style placeholders a string expects. */
  const placeholders = (value: string): string[] =>
    (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();

  it("expects the same placeholders in both languages", () => {
    for (const key of arKeys) {
      const ar = placeholders(String(valueAt(translations.ar, key)));
      const en = placeholders(String(valueAt(translations.en, key)));
      expect(en, `placeholders differ at ${key}`).toEqual(ar);
    }
  });
});

describe("the Arabic bundle", () => {
  // The language switch is labelled with the language it switches TO, so it
  // reads "EN" in the Arabic bundle and is not a missed translation.
  const DELIBERATELY_LATIN = new Set(["langToggle"]);

  it("is actually written in Arabic across the navigation", () => {
    // A key left as its English copy is the usual way a translation gets
    // forgotten, and the navigation is on every page.
    const nav = translations.ar.nav as Record<string, string>;
    const untranslated = Object.entries(nav)
      .filter(([key]) => !DELIBERATELY_LATIN.has(key))
      .filter(([, value]) => !/[؀-ۿ]/.test(value))
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });

  it("still labels the language switch in Latin script", () => {
    expect(translations.ar.nav.langToggle).toBe("EN");
  });

  it("labels the switch the other way round in English", () => {
    expect(translations.en.nav.langToggle).not.toBe(
      translations.ar.nav.langToggle,
    );
  });
});
