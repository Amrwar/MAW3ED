import { describe, it, expect, vi, beforeEach } from "vitest";

const generateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => generateText(...args),
  Output: { object: (o: unknown) => o },
}));
vi.mock("@/lib/db", () => ({ db: {} }));

import { englishOf } from "./english";
import { fingerprint, hasArabic, planField, translateItems, translationEnabled } from "./index";

describe("hasArabic", () => {
  it("finds Arabic script, and only that", () => {
    expect(hasArabic("عيادة د هانم")).toBe(true);
    expect(hasArabic("BerryGum عيادة")).toBe(true);
    expect(hasArabic("BerryGum")).toBe(false);
    expect(hasArabic("")).toBe(false);
    expect(hasArabic(null)).toBe(false);
  });
});

describe("planField", () => {
  const ar = "محمد صلاح للحلاقة";

  it("translates Arabic that has no English yet", () => {
    const p = planField({ field: "name", kind: "name", source: ar, current: null }, {});
    expect(p).toEqual({ action: "translate", source: ar, hash: fingerprint(ar) });
  });

  it("keeps a translation whose Arabic has not changed", () => {
    const p = planField({ field: "name", kind: "name", source: ar, current: "Mohamed Salah Barbershop" }, { name: fingerprint(ar) });
    expect(p).toEqual({ action: "keep" });
  });

  it("redoes it when the Arabic changed", () => {
    const p = planField(
      { field: "name", kind: "name", source: "صالون جديد", current: "Mohamed Salah Barbershop" },
      { name: fingerprint(ar) },
    );
    expect(p.action).toBe("translate");
  });

  it("drops the machine English once the owner writes their own", () => {
    const p = planField(
      { field: "name", kind: "name", source: ar, ownerEnglish: "Salah Barbers", current: "Mohamed Salah Barbershop" },
      { name: fingerprint(ar) },
    );
    expect(p).toEqual({ action: "clear" });
  });

  it("ignores text that is not Arabic (an about written in English)", () => {
    expect(planField({ field: "about", kind: "text", source: "We build websites", current: null }, {})).toEqual({ action: "keep" });
  });

  it("clears a translation when the Arabic was removed", () => {
    expect(planField({ field: "tagline", kind: "text", source: "", current: "Old" }, { tagline: "x" })).toEqual({ action: "clear" });
  });

  it("does not resend a text the model failed on, except from the nightly run", () => {
    const stored = { name: `failed:${fingerprint(ar)}` };
    const state = { field: "name", kind: "name" as const, source: ar, current: null };
    expect(planField(state, stored)).toEqual({ action: "keep" });
    expect(planField(state, stored, true).action).toBe("translate");
    // A changed Arabic starts afresh, nightly or not.
    expect(planField({ ...state, source: "صالون جديد" }, stored).action).toBe("translate");
  });

  it("treats whitespace-only owner English as none", () => {
    const p = planField({ field: "name", kind: "name", source: ar, ownerEnglish: "   ", current: null }, {});
    expect(p.action).toBe("translate");
  });
});

describe("translateItems", () => {
  beforeEach(() => generateText.mockReset());

  it("returns English per requested id, dropping unknown ids and Arabic echoes", async () => {
    generateText.mockResolvedValue({
      output: {
        translations: [
          { id: "a", english: "  Mohamed Salah Barbershop " },
          { id: "b", english: "عيادة" }, // came back untranslated
          { id: "zzz", english: "Not asked for" },
        ],
      },
    });
    const out = await translateItems([
      { id: "a", kind: "name", source: "محمد صلاح للحلاقة" },
      { id: "b", kind: "name", source: "عيادة" },
    ]);
    expect([...out.entries()]).toEqual([["a", "Mohamed Salah Barbershop"]]);
  });

  it("bounds the model call with a timeout, so a hung request cannot eat the cron budget", async () => {
    generateText.mockResolvedValue({ output: { translations: [] } });
    await translateItems([{ id: "a", kind: "name", source: "عيادة" }]);
    const signal = generateText.mock.calls[0][0].abortSignal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal.aborted).toBe(false);
  });

  it("makes no call for an empty batch", async () => {
    expect((await translateItems([])).size).toBe(0);
    expect(generateText).not.toHaveBeenCalled();
  });
});

describe("translationEnabled", () => {
  it("is on with a gateway key or on Vercel, off when switched off", () => {
    expect(translationEnabled({})).toBe(false);
    expect(translationEnabled({ AI_GATEWAY_API_KEY: "k" })).toBe(true);
    expect(translationEnabled({ VERCEL: "1" })).toBe(true);
    expect(translationEnabled({ VERCEL: "1", AUTO_TRANSLATE: "0" })).toBe(false);
  });
});

describe("englishOf", () => {
  it("prefers the owner's English, then the machine's", () => {
    expect(englishOf("Salah Barbers", "Mohamed Salah Barbershop")).toBe("Salah Barbers");
    expect(englishOf("  ", "Mohamed Salah Barbershop")).toBe("Mohamed Salah Barbershop");
    expect(englishOf(null, null)).toBeNull();
  });
});
