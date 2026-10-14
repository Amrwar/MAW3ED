import { describe, expect, it } from "vitest";
import { dateTime, formatPhone, instantTime, joinParts } from "./format";

const LRI = "⁦";
const FSI = "⁨";
const PDI = "⁩";
const RLM = "‏";
const LRM = "‎";

describe("bidi helpers", () => {
  it("shows a phone as +digits, isolated left to right", () => {
    expect(formatPhone("201000000777")).toBe(`${LRI}+201000000777${PDI}`);
    expect(formatPhone("+201000000777")).toBe(`${LRI}+201000000777${PDI}`);
  });

  it("isolates each piece of a joined line and drops empty ones", () => {
    expect(joinParts(["QA PushPay", null, "17 أكتوبر", ""], "ar")).toBe(`${RLM}${FSI}QA PushPay${PDI} · ${FSI}17 أكتوبر${PDI}`);
    expect(joinParts(["Cut", "Sara"], "en")).toBe(`${LRM}${FSI}Cut${PDI} · ${FSI}Sara${PDI}`);
    expect(joinParts([null], "ar")).toBe("");
  });
});

describe("instants", () => {
  // 21:33:08 UTC is 00:33 the next day in Cairo (UTC+3 in October 2026).
  const iso = "2026-10-14T21:33:08Z";

  it("formats the Cairo time without seconds, in Latin digits", () => {
    expect(instantTime(iso, "en")).toBe("12:33 AM");
    expect(instantTime(iso, "ar")).toBe("12:33 ص");
  });

  it("puts the Cairo day and time together", () => {
    const en = dateTime(iso, "en");
    expect(en).toContain("Oct 15");
    expect(en).toContain("12:33 AM");
    expect(dateTime(iso, "ar")).not.toMatch(/[٠-٩]/);
  });

  it("returns empty for a bad instant rather than Invalid Date", () => {
    expect(dateTime("nope", "en")).toBe("");
  });
});
