import { describe, expect, it, vi } from "vitest";

/**
 * The organization's package report reads only live grants of an approved
 * organization (final audit F-25). It filtered on APPROVED and not
 * suspended alone, so after a grant expired, or the platform suspended the
 * organization, its members still saw the brands' package figures.
 */

const { seen } = vi.hoisted(() => ({ seen: [] as unknown[] }));

vi.mock("@/lib/db", () => ({
  db: {
    organizationBusiness: {
      findMany: vi.fn(async (args: { where: unknown }) => {
        seen.push(args.where);
        return [];
      }),
    },
  },
}));

import { organizationPackageReport } from "./loyalty";

describe("organizationPackageReport", () => {
  it("asks only for unexpired grants of an approved organization", async () => {
    await organizationPackageReport("o1");
    const where = seen[0] as Record<string, unknown>;
    expect(where.organization).toEqual({ status: "APPROVED" });
    const or = where.OR as Record<string, unknown>[];
    expect(or).toContainEqual({ expiresAt: null });
    expect(or.some((c) => c.expiresAt && typeof c.expiresAt === "object" && "gt" in (c.expiresAt as object))).toBe(true);
  });
});
