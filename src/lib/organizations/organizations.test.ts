import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { ORG_ACTIONS, ORG_PERMISSIONS, orgAuthorityOver, orgCan } from "./access";
import { pageDirectory, orgDirectoryCategories, directorySections, type OrgDirectoryEntry } from "./public";
import { orgSeo } from "./seo";
import { orgRegisterSchema, orgProfileSchema, orgSlugSchema } from "./rules";

const roles = (...r: { kind: "ORGANIZATION_OWNER" | "ORGANIZATION_ADMIN" | "VENUE_MANAGER"; organizationId?: string | null }[]) =>
  r.map((x) => ({ kind: x.kind, organizationId: x.organizationId ?? null }));

describe("organization authority", () => {
  it("owner, manager and platform reach only their own organization", () => {
    const owner = { platform: false, roles: roles({ kind: "ORGANIZATION_OWNER", organizationId: "o1" }) };
    const manager = { platform: false, roles: roles({ kind: "ORGANIZATION_ADMIN", organizationId: "o1" }) };
    expect(orgAuthorityOver(owner, "o1")).toBe("OWNER");
    expect(orgAuthorityOver(owner, "o2")).toBeNull();
    expect(orgAuthorityOver(manager, "o1")).toBe("MANAGER");
    expect(orgAuthorityOver({ platform: true, roles: [] }, "anything")).toBe("PLATFORM");
    // A venue manager, a business owner or a customer has no organization authority.
    expect(orgAuthorityOver({ platform: false, roles: roles({ kind: "VENUE_MANAGER" }) }, "o1")).toBeNull();
    expect(orgAuthorityOver({ platform: false, roles: [] }, "o1")).toBeNull();
  });

  it("managers cannot publish, manage members or review; owners cannot review", () => {
    expect(orgCan("MANAGER", "org.publish")).toBe(false);
    expect(orgCan("MANAGER", "org.members")).toBe(false);
    expect(orgCan("MANAGER", "org.review")).toBe(false);
    expect(orgCan("OWNER", "org.publish")).toBe(true);
    expect(orgCan("OWNER", "org.members")).toBe(true);
    expect(orgCan("OWNER", "org.review")).toBe(false);
    for (const a of ORG_ACTIONS) expect(orgCan("PLATFORM", a)).toBe(true);
    for (const a of ORG_ACTIONS) expect(orgCan(null, a)).toBe(false);
    expect(ORG_PERMISSIONS.MANAGER).toContain("org.associations.manage");
  });
});

const entry = (n: number, cat: string, section: string | null): OrgDirectoryEntry => ({
  associationId: `a${n}`,
  slug: `biz-${n}`,
  nameAr: `نشاط ${n}`,
  nameEn: `Biz ${n}`,
  logoImage: null,
  ratingAvg: 0,
  ratingCount: 0,
  isVerified: false,
  relation: "TENANT",
  section,
  sortOrder: n,
  category: { slug: cat, nameAr: cat, nameEn: cat },
  city: null,
  branch: null,
});

describe("directory paging (an organization with hundreds of businesses)", () => {
  const many = Array.from({ length: 300 }, (_, i) => entry(i, i % 3 === 0 ? "cafes" : "clinics", i % 2 ? "A" : null));
  it("pages, filters and searches without loading everything onto one page", () => {
    const p1 = pageDirectory(many, {});
    expect(p1.entries).toHaveLength(24);
    expect(p1.total).toBe(300);
    expect(p1.pages).toBe(13);
    const p13 = pageDirectory(many, { page: 13 });
    expect(p13.entries).toHaveLength(300 - 12 * 24);
    // Out-of-range pages clamp instead of rendering nothing.
    expect(pageDirectory(many, { page: 99 }).page).toBe(13);
    expect(pageDirectory(many, { category: "cafes" }).total).toBe(100);
    expect(pageDirectory(many, { section: "A" }).total).toBe(150);
    expect(pageDirectory(many, { q: "Biz 299" }).total).toBe(1);
    expect(directorySections(many)).toEqual(["A"]);
    expect(orgDirectoryCategories(many).map((c) => c.slug)).toEqual(["clinics", "cafes"]);
  });
  it("an empty directory pages to one empty page", () => {
    expect(pageDirectory([], {})).toEqual({ entries: [], total: 0, page: 1, pages: 1 });
  });
});

describe("organization SEO", () => {
  const base = { slug: "sample-mall", kind: "MALL", nameAr: "مول تجريبي", nameEn: "Sample Mall", city: { nameAr: "القاهرة", nameEn: "Cairo" } };
  it("writes both languages and does not index an empty organization", () => {
    const ar = orgSeo({ ...base, directory: [1, 2, 3] }, "ar");
    const en = orgSeo({ ...base, directory: [1, 2, 3] }, "en");
    expect(ar).toMatchObject({ path: "/groups/sample-mall", index: true });
    expect(ar.title).toMatch(/مول تجريبي/);
    expect(en.description).toMatch(/3 places of Sample Mall, a mall in Cairo/);
    expect(orgSeo({ ...base, directory: [] }, "en").index).toBe(false);
  });
});

describe("organization input rules", () => {
  it("refuses reserved and malformed slugs", () => {
    for (const bad of ["groups", "admin", "api", "ab", "Has Space", "-x-", "عربي"]) {
      expect(orgSlugSchema.safeParse(bad).success, bad).toBe(false);
    }
    expect(orgSlugSchema.safeParse("eterna").success).toBe(true);
  });
  it("validates registration and profile", () => {
    expect(orgRegisterSchema.safeParse({ slug: "eterna", kind: "MALL", nameAr: "إتيرنا" }).success).toBe(true);
    expect(orgRegisterSchema.safeParse({ slug: "eterna", kind: "SHOP", nameAr: "إتيرنا" }).success).toBe(false);
    expect(orgProfileSchema.safeParse({ website: "javascript:alert(1)" }).success).toBe(false);
    expect(orgProfileSchema.safeParse({ website: "https://example.com", email: "" }).success).toBe(true);
  });
});
