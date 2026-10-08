import { describe, it, expect } from "vitest";
import { translations } from "./i18n";
import { SUPPORT_EMAIL } from "./support";

/**
 * The address used to be typed out in four places here. These exist so
 * it cannot drift back: a fifth copy, or one copy changed and the
 * others not, means the contact card and the FAQ disagree about where
 * to write.
 */

describe("the contact copy", () => {
  it("shows the configured address in both languages", () => {
    for (const lang of ["ar", "en"] as const) {
      const values = translations[lang].contact.channels.map((c) => c.value);
      expect(values, lang).toContain(SUPPORT_EMAIL);
    }
  });

  it("answers the FAQ with the same address", () => {
    for (const lang of ["ar", "en"] as const) {
      const answers = translations[lang].faq.items.map((i) => i.a).join(" ");
      expect(answers, lang).toContain(SUPPORT_EMAIL);
    }
  });

  it("has no second address hardcoded anywhere in the copy", () => {
    // Any maw3ed.net address in the translations that is not the
    // configured one is a copy that will go stale.
    const all = JSON.stringify(translations);
    const found = all.match(/[A-Za-z0-9._%+-]+@maw3ed\.net/g) ?? [];
    for (const address of found) expect(address).toBe(SUPPORT_EMAIL);
  });
});
