import { describe, expect, it, vi } from "vitest";

/**
 * A suspended organization's people lose its venues (final audit F-22).
 * Venue authority came from role rows alone, so after the platform
 * suspended an organization its owner still ran the desk (visitor names),
 * membership decisions and overrides.
 */

const { state } = vi.hoisted(() => ({ state: { orgStatus: "APPROVED" } }));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async () => ({
        id: "u1",
        name: "Owner",
        adminRole: null,
        venueRoles: [{ kind: "ORGANIZATION_OWNER", organizationId: "o1", compoundId: null, venueId: null }],
      }),
    },
    venue: { findUnique: async () => ({ id: "v1", organizationId: "o1", compoundId: null, status: "ACTIVE", isPublished: true }) },
    organization: { findUnique: async () => ({ status: state.orgStatus }) },
  },
}));
vi.mock("@/lib/api", () => ({
  currentCaller: async () => ({ user: { id: "u1" } }),
  err: (error: string, status = 400) => Response.json({ error }, { status }),
}));
vi.mock("@/lib/admin/permissions", () => ({ can: () => false }));

import { requireVenueAccess } from "./guard";

describe("venue access and the organization's status", () => {
  it("lets an approved organization's owner open the desk", async () => {
    state.orgStatus = "APPROVED";
    const r = await requireVenueAccess("v1", "venue.access.view");
    expect(r.authority).toBe("ORGANIZATION_OWNER");
  });

  it("lets an operator the platform added itself (status PENDING) run its venues", async () => {
    state.orgStatus = "PENDING";
    expect((await requireVenueAccess("v1", "venue.access.view")).authority).toBe("ORGANIZATION_OWNER");
  });

  it("refuses with 404 once the platform suspends the organization", async () => {
    state.orgStatus = "SUSPENDED";
    const thrown = await requireVenueAccess("v1", "venue.access.view").catch((e) => e);
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(404);
  });
});
