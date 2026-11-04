import { describe, expect, it } from "vitest";

import { arabicStem, englishSingular, MAX_WORDS, searchTerms } from "./synonyms";
import { normalizeSearch, SQL_FOLD_FROM, SQL_FOLD_TO } from "./normalize";

describe("arabicStem", () => {
  it("lets singular and plural meet", () => {
    expect(arabicStem("عيادة")).toBe("عياد");
    expect(arabicStem("العيادات")).toBe("عياد");
    expect(arabicStem("صالونات")).toBe("صالون");
  });

  it("leaves short words, Latin words and bare stems alone", () => {
    expect(arabicStem("جيم")).toBeNull();
    expect(arabicStem("doctor")).toBeNull();
    expect(arabicStem("حلاق")).toBeNull();
  });
});

describe("searchTerms", () => {
  it("gives one set of alternatives per word, the word as typed first", () => {
    const terms = searchTerms("  Dr   Hanem ");
    expect(terms.map((t) => t[0])).toEqual(["dr", "hanem"]);
    expect(searchTerms("")).toEqual([]);
  });

  it("widens a word to the places it names, in both languages", () => {
    // Alternatives come folded (ة → ه), the spelling the stored names are compared in.
    expect(searchTerms("doctor")[0]).toEqual(expect.arrayContaining(["clinic", "عياده", "دكتور"]));
    expect(searchTerms("dentist")[0]).toEqual(expect.arrayContaining(["سنان", "teeth"]));
    expect(searchTerms("أسنان")[0]).toEqual(expect.arrayContaining(["dentist"]));
  });

  it("matches a group from a plural or with the article, word by word", () => {
    expect(searchTerms("العيادات")[0]).toEqual(expect.arrayContaining(["عياد", "doctor"]));
    const [barber, place] = searchTerms("barber maadi");
    expect(barber).toEqual(expect.arrayContaining(["حلاق"]));
    expect(place).toEqual(["maadi"]);
  });

  it("does not reach a group through a stem", () => {
    // الرياض stems to رياض, as رياضة does; it is a place, not a gym.
    expect(searchTerms("الرياض")[0]).not.toContain("جيم");
  });

  it("drops alternatives a shorter one already covers", () => {
    const doctor = searchTerms("doctor")[0];
    expect(doctor).toContain("clinic");
    expect(doctor).not.toContain("clinics");
    expect(doctor).not.toContain("دكتورة");
  });

  it("does not add short Latin words that hide inside others", () => {
    expect(searchTerms("massage")[0]).not.toContain("spa");
    expect(searchTerms("spa")[0]).toContain("spa");
  });

  it("leaves an unknown word as it is", () => {
    expect(searchTerms("berrygum")).toEqual([["berrygum"]]);
  });
});

describe("Arabic folding (Phase 26)", () => {
  it("folds the spellings people actually type", () => {
    expect(normalizeSearch("أحمد")).toBe(normalizeSearch("احمد"));
    expect(normalizeSearch("إسلام")).toBe("اسلام");
    expect(normalizeSearch("مستشفى")).toBe(normalizeSearch("مستشفي"));
    expect(normalizeSearch("عيادة")).toBe(normalizeSearch("عياده"));
    expect(normalizeSearch("عيَادَة")).toBe("عياده");
    expect(normalizeSearch("عيـــادة")).toBe("عياده");
    expect(normalizeSearch("المعادى")).toBe("المعادي");
    expect(normalizeSearch("مؤسسة")).toBe("موسسه");
    expect(normalizeSearch("٢٠٢٦ ۱۲")).toBe("2026 12");
    expect(normalizeSearch("  Dr.   HANEM ")).toBe("dr. hanem");
    expect(normalizeSearch(null)).toBe("");
  });

  it("the TypeScript and SQL fold tables are the same table", () => {
    expect([...SQL_FOLD_FROM].length).toBe([...SQL_FOLD_TO].length);
    for (const [i, c] of [...SQL_FOLD_FROM].entries()) expect(normalizeSearch(c)).toBe([...SQL_FOLD_TO][i]);
  });

  it("a query is folded before it is widened", () => {
    expect(searchTerms("احمد")).toEqual([["احمد"]]);
    expect(searchTerms("أحمد")).toEqual([["احمد"]]);
    expect(searchTerms("اسنان")[0]).toEqual(expect.arrayContaining(["dentist"]));
    expect(searchTerms("عياده")[0]).toEqual(expect.arrayContaining(["doctor"]));
  });

  it("caps the number of words", () => {
    expect(searchTerms("a b c d e f g h")).toHaveLength(MAX_WORDS);
  });
});

describe("englishSingular", () => {
  it("widens plurals to the singular, leaves the rest", () => {
    expect(englishSingular("clinics")).toBe("clinic");
    expect(englishSingular("therapies")).toBe("therapy");
    expect(englishSingular("glass")).toBeNull();
    expect(englishSingular("campus")).toBeNull();
    expect(englishSingular("gas")).toBeNull();
    expect(englishSingular("عيادات")).toBeNull();
    expect(searchTerms("physiotherapists")[0]).toContain("physiotherapist");
  });
});
