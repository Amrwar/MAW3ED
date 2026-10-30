import { describe, it, expect } from "vitest";
import { authorityOver, venueCan, canEditCompoundGates, VENUE_ACTIONS, type RoleGrant } from "./access";

const venueA = { id: "vA", organizationId: "org1", compoundId: "c1" };
const venueB = { id: "vB", organizationId: "org1", compoundId: "c2" };
const venueC = { id: "vC", organizationId: "org2", compoundId: null };
const role = (r: Partial<RoleGrant> & Pick<RoleGrant, "kind">): RoleGrant => ({ organizationId: null, compoundId: null, venueId: null, ...r });
const who = (roles: RoleGrant[], platform = false) => ({ platform, roles });

describe("venue authority", () => {
  it("a venue manager reaches only their own venue", () => {
    const m = who([role({ kind: "VENUE_MANAGER", venueId: "vA" })]);
    expect(authorityOver(m, venueA)).toBe("VENUE_MANAGER");
    expect(authorityOver(m, venueB)).toBeNull();
    expect(authorityOver(m, venueC)).toBeNull();
  });

  it("a compound admin reaches every venue in the compound and nothing else", () => {
    const c = who([role({ kind: "COMPOUND_ADMIN", compoundId: "c1" })]);
    expect(authorityOver(c, venueA)).toBe("COMPOUND_ADMIN");
    expect(authorityOver(c, venueB)).toBeNull();
  });

  it("an organisation admin reaches all the organisation's venues, across compounds", () => {
    const o = who([role({ kind: "ORGANIZATION_ADMIN", organizationId: "org1" })]);
    expect(authorityOver(o, venueA)).toBe("ORGANIZATION_ADMIN");
    expect(authorityOver(o, venueB)).toBe("ORGANIZATION_ADMIN");
    expect(authorityOver(o, venueC)).toBeNull();
  });

  it("a venue with no organisation or compound is never matched by a null scope", () => {
    const loose = { id: "vX", organizationId: null, compoundId: null };
    expect(authorityOver(who([role({ kind: "ORGANIZATION_ADMIN", organizationId: null })]), loose)).toBeNull();
    expect(authorityOver(who([role({ kind: "COMPOUND_ADMIN", compoundId: null })]), loose)).toBeNull();
  });

  it("reports the widest authority when several apply", () => {
    const both = who([role({ kind: "VENUE_MANAGER", venueId: "vA" }), role({ kind: "ORGANIZATION_ADMIN", organizationId: "org1" })]);
    expect(authorityOver(both, venueA)).toBe("ORGANIZATION_ADMIN");
  });

  it("only the platform publishes venues or grants roles", () => {
    for (const a of ["ORGANIZATION_ADMIN", "COMPOUND_ADMIN", "VENUE_MANAGER"] as const) {
      expect(venueCan(a, "venue.publish")).toBe(false);
      expect(venueCan(a, "venue.roles.grant")).toBe(false);
      expect(venueCan(a, "venue.memberships.decide")).toBe(true);
      expect(venueCan(a, "venue.metrics")).toBe(true);
    }
    for (const action of VENUE_ACTIONS) expect(venueCan("PLATFORM", action)).toBe(true);
  });

  it("somebody with no venue role — a business owner, staff, a customer — can do nothing", () => {
    const nobody = who([]);
    expect(authorityOver(nobody, venueA)).toBeNull();
    for (const action of VENUE_ACTIONS) expect(venueCan(null, action)).toBe(false);
  });

  it("compound gates need authority over the whole compound", () => {
    const c1 = { id: "c1", organizationId: "org1" };
    expect(canEditCompoundGates(who([role({ kind: "VENUE_MANAGER", venueId: "vA" })]), c1)).toBe(false);
    expect(canEditCompoundGates(who([role({ kind: "COMPOUND_ADMIN", compoundId: "c1" })]), c1)).toBe(true);
    expect(canEditCompoundGates(who([role({ kind: "COMPOUND_ADMIN", compoundId: "c2" })]), c1)).toBe(false);
    expect(canEditCompoundGates(who([role({ kind: "ORGANIZATION_ADMIN", organizationId: "org1" })]), c1)).toBe(true);
    expect(canEditCompoundGates(who([], true), c1)).toBe(true);
  });
});
