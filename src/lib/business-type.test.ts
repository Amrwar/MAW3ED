import { describe, expect, it } from "vitest";

import {
  BUSINESS_TYPE_META,
  TABLE_TYPE_LABELS,
  hasStaffManagement,
  hasTableManagement,
  isDurationRequired,
  type BusinessType,
} from "./business-type";

const TYPES: BusinessType[] = ["GENERAL", "RESTAURANT", "BARBERSHOP"];

describe("the business types", () => {
  it("all carry metadata", () => {
    for (const type of TYPES) {
      expect(BUSINESS_TYPE_META[type]).toBeDefined();
    }
  });

  it("carry no metadata for a type that does not exist", () => {
    expect(Object.keys(BUSINESS_TYPE_META).sort()).toEqual([...TYPES].sort());
  });

  it("are named in both languages", () => {
    for (const type of TYPES) {
      expect(BUSINESS_TYPE_META[type].ar.trim().length).toBeGreaterThan(0);
      expect(BUSINESS_TYPE_META[type].en.trim().length).toBeGreaterThan(0);
    }
  });

  it("are described in both languages", () => {
    for (const type of TYPES) {
      expect(BUSINESS_TYPE_META[type].descAr.trim().length).toBeGreaterThan(0);
      expect(BUSINESS_TYPE_META[type].descEn.trim().length).toBeGreaterThan(0);
    }
  });

  it("have an emoji each", () => {
    for (const type of TYPES) {
      expect(BUSINESS_TYPE_META[type].emoji.length).toBeGreaterThan(0);
    }
  });

  it("do not share an English name between two types", () => {
    const names = TYPES.map((type) => BUSINESS_TYPE_META[type].en);
    expect(new Set(names).size).toBe(names.length);
  });

  it("do not share an Arabic name between two types", () => {
    const names = TYPES.map((type) => BUSINESS_TYPE_META[type].ar);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("hasTableManagement", () => {
  it("is on for a restaurant", () => {
    expect(hasTableManagement("RESTAURANT")).toBe(true);
  });

  it("is off for a barbershop", () => {
    expect(hasTableManagement("BARBERSHOP")).toBe(false);
  });

  it("is off for a general business", () => {
    expect(hasTableManagement("GENERAL")).toBe(false);
  });

  it("is on for exactly one type", () => {
    expect(TYPES.filter(hasTableManagement)).toHaveLength(1);
  });
});

describe("hasStaffManagement", () => {
  it("is on for a barbershop", () => {
    expect(hasStaffManagement("BARBERSHOP")).toBe(true);
  });

  it("is off for a restaurant", () => {
    expect(hasStaffManagement("RESTAURANT")).toBe(false);
  });

  it("is off for a general business", () => {
    expect(hasStaffManagement("GENERAL")).toBe(false);
  });

  it("is on for exactly one type", () => {
    expect(TYPES.filter(hasStaffManagement)).toHaveLength(1);
  });
});

describe("tables and staff", () => {
  it("are never both on for the same type", () => {
    for (const type of TYPES) {
      expect(hasTableManagement(type) && hasStaffManagement(type)).toBe(false);
    }
  });
});

describe("isDurationRequired", () => {
  it("is off for a restaurant, where a table is booked rather than a slot", () => {
    expect(isDurationRequired("RESTAURANT")).toBe(false);
  });

  it("is on for a barbershop", () => {
    expect(isDurationRequired("BARBERSHOP")).toBe(true);
  });

  it("is on for a general business", () => {
    expect(isDurationRequired("GENERAL")).toBe(true);
  });

  it("is off exactly where table management is on", () => {
    for (const type of TYPES) {
      expect(isDurationRequired(type)).toBe(!hasTableManagement(type));
    }
  });
});

describe("the table type labels", () => {
  it("are offered", () => {
    expect(Object.keys(TABLE_TYPE_LABELS).length).toBeGreaterThan(0);
  });

  it("name every table type in both languages", () => {
    for (const [key, label] of Object.entries(TABLE_TYPE_LABELS)) {
      expect(label.ar.trim().length, `${key} has no Arabic label`).toBeGreaterThan(0);
      expect(label.en.trim().length, `${key} has no English label`).toBeGreaterThan(0);
    }
  });

  it("key every label in upper case, as the enum stores them", () => {
    for (const key of Object.keys(TABLE_TYPE_LABELS)) {
      expect(key).toBe(key.toUpperCase());
    }
  });

  it("give each table type its own English label", () => {
    const labels = Object.values(TABLE_TYPE_LABELS).map((label) => label.en);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("carry no untrimmed padding into the markup", () => {
    for (const label of Object.values(TABLE_TYPE_LABELS)) {
      expect(label.ar).toBe(label.ar.trim());
      expect(label.en).toBe(label.en.trim());
    }
  });
});
