import { describe, expect, it } from "vitest";

import { PERMISSIONS, ROLE_PERMISSIONS, can, canAny } from "./permissions";
import type { Permission } from "./permissions";

describe("nobody is an administrator by default", () => {
  it("refuses every permission to somebody with no role", () => {
    for (const p of PERMISSIONS) {
      expect(can(null, p), p).toBe(false);
      expect(can(undefined, p), p).toBe(false);
    }
  });

  it("fails closed on a permission that does not exist", () => {
    // A typo in a route name must deny, not allow.
    expect(can("SUPER_ADMIN", "nonsense.permission" as Permission)).toBe(false);
    expect(can("ADMIN", "" as Permission)).toBe(false);
  });
});

describe("a moderator sees reviews and nothing else", () => {
  it("can moderate reviews", () => {
    expect(can("MODERATOR", "reviews.read")).toBe(true);
    expect(can("MODERATOR", "reviews.moderate")).toBe(true);
  });

  it("cannot read what anybody paid", () => {
    // The whole reason for three roles rather than one flag: somebody
    // reading reported reviews all day does not need payment data.
    expect(can("MODERATOR", "payments.read")).toBe(false);
    expect(can("MODERATOR", "subscriptions.read")).toBe(false);
  });

  it("cannot touch businesses, customers or bookings", () => {
    for (const p of [
      "businesses.read",
      "businesses.moderate",
      "businesses.edit",
      "customers.read",
      "bookings.read",
      "catalogue.edit",
    ] as Permission[]) {
      expect(can("MODERATOR", p), p).toBe(false);
    }
  });

  it("cannot grant itself anything", () => {
    expect(can("MODERATOR", "roles.grant")).toBe(false);
    expect(can("MODERATOR", "settings.manage")).toBe(false);
  });
});

describe("an admin runs the platform but not the money", () => {
  it("can do everything a moderator can", () => {
    for (const p of ROLE_PERMISSIONS.MODERATOR) {
      expect(can("ADMIN", p), p).toBe(true);
    }
  });

  it("can moderate and edit businesses", () => {
    expect(can("ADMIN", "businesses.moderate")).toBe(true);
    expect(can("ADMIN", "businesses.verify")).toBe(true);
    expect(can("ADMIN", "catalogue.edit")).toBe(true);
  });

  it("cannot read payments or subscriptions", () => {
    expect(can("ADMIN", "payments.read")).toBe(false);
    expect(can("ADMIN", "subscriptions.read")).toBe(false);
    expect(can("ADMIN", "subscriptions.manage")).toBe(false);
  });

  it("cannot promote itself to super admin", () => {
    // The escalation path that would make the other boundaries
    // decorative.
    expect(can("ADMIN", "roles.grant")).toBe(false);
    expect(can("ADMIN", "settings.manage")).toBe(false);
  });
});

describe("a super admin", () => {
  it("has every permission there is", () => {
    for (const p of PERMISSIONS) {
      expect(can("SUPER_ADMIN", p), p).toBe(true);
    }
  });

  it("can do everything an admin can", () => {
    for (const p of ROLE_PERMISSIONS.ADMIN) {
      expect(can("SUPER_ADMIN", p), p).toBe(true);
    }
  });
});

describe("the roles nest", () => {
  it("never takes a permission away as the role widens", () => {
    // A wider role that lost something would be a boundary nobody
    // expects and a bug that only shows up for one person.
    for (const p of ROLE_PERMISSIONS.MODERATOR) {
      expect(ROLE_PERMISSIONS.ADMIN, p).toContain(p);
    }
    for (const p of ROLE_PERMISSIONS.ADMIN) {
      expect(ROLE_PERMISSIONS.SUPER_ADMIN, p).toContain(p);
    }
  });

  it("lists no permission that is not declared", () => {
    for (const role of ["MODERATOR", "ADMIN", "SUPER_ADMIN"] as const) {
      for (const p of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS, `${role}: ${p}`).toContain(p);
      }
    }
  });

  it("grants every declared permission to somebody", () => {
    // A permission no role has is a feature nobody can reach.
    for (const p of PERMISSIONS) {
      expect(can("SUPER_ADMIN", p), `nobody can ${p}`).toBe(true);
    }
  });
});

describe("canAny", () => {
  it("is true when one of them is allowed", () => {
    expect(canAny("MODERATOR", ["payments.read", "reviews.read"])).toBe(true);
  });

  it("is false when none is", () => {
    expect(canAny("MODERATOR", ["payments.read", "settings.manage"])).toBe(false);
  });

  it("is false for somebody with no role, whatever is asked", () => {
    expect(canAny(null, [...PERMISSIONS])).toBe(false);
  });
});
