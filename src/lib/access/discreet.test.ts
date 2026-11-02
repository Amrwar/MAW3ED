import { describe, expect, it } from "vitest";
import { discreetByCategory, isDiscreet } from "./discreet";

/** P23-A5: which businesses a venue's security desk does not name. */
describe("discreet businesses", () => {
  it("medical categories are discreet by default, others are not", () => {
    for (const slug of ["clinics", "dentists", "labs"]) expect(discreetByCategory({ slug })).toBe(true);
    for (const slug of ["salons", "restaurants", "gyms", "legal"]) expect(discreetByCategory({ slug })).toBe(false);
    expect(discreetByCategory(null)).toBe(false);
  });

  it("a subcategory follows its parent", () => {
    expect(discreetByCategory({ slug: "pediatrics", parent: { slug: "clinics" } })).toBe(true);
    expect(discreetByCategory({ slug: "nails", parent: { slug: "salons" } })).toBe(false);
  });

  it("the owner's choice wins either way", () => {
    expect(isDiscreet({ accessDiscreet: false, category: { slug: "clinics" } })).toBe(false);
    expect(isDiscreet({ accessDiscreet: true, category: { slug: "salons" } })).toBe(true);
    expect(isDiscreet({ accessDiscreet: null, category: { slug: "dentists" } })).toBe(true);
    expect(isDiscreet({ accessDiscreet: null, category: { slug: "salons" } })).toBe(false);
  });
});
