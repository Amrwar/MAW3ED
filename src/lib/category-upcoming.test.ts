import { describe, it, expect } from "vitest";
import { upcomingCategories } from "./category-upcoming";

const cat = (id: string, count: number, parentId: string | null = null) => ({ id, slug: id, count, parentId });

describe("upcomingCategories", () => {
  it("lists empty categories, most wanted first", () => {
    const out = upcomingCategories([cat("legal", 0), cat("gyms", 0), cat("dentists", 0), cat("cars", 2)]);
    expect(out.map((c) => c.slug)).toEqual(["dentists", "gyms", "legal"]);
  });

  it("does not call a parent coming when a subcategory has businesses", () => {
    const out = upcomingCategories([cat("beauty", 0), cat("salons", 3, "beauty")]);
    expect(out).toEqual([]);
  });

  it("does not call a subcategory coming when its parent has businesses", () => {
    const out = upcomingCategories([cat("medical", 5), cat("dentists", 0, "medical")]);
    expect(out).toEqual([]);
  });

  it("caps at the limit, and treats a negative one as none", () => {
    const all = [cat("gyms", 0), cat("spas", 0), cat("labs", 0)];
    expect(upcomingCategories(all, 2)).toHaveLength(2);
    expect(upcomingCategories(all, -1)).toEqual([]);
  });
});
