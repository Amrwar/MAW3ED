import { describe, expect, it } from "vitest";

import { arabicStem, searchTerms } from "./synonyms";

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
    expect(searchTerms("doctor")[0]).toEqual(expect.arrayContaining(["clinic", "عيادة", "دكتور"]));
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
