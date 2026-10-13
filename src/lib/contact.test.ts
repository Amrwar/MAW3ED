import { describe, expect, it } from "vitest";

import { telHref, whatsappHref } from "./contact";

describe("telHref", () => {
  it("strips the spaces an owner types, which make the URI invalid", () => {
    expect(telHref("0111 1908224")).toBe("tel:01111908224");
    expect(telHref("011 119 08224")).toBe("tel:01111908224");
  });

  it("strips dashes, brackets and dots", () => {
    expect(telHref("011-119-08224")).toBe("tel:01111908224");
    expect(telHref("(011) 1190.8224")).toBe("tel:01111908224");
  });

  it("keeps a leading plus, because a dialer needs it", () => {
    expect(telHref("+20 111 190 8224")).toBe("tel:+201111908224");
  });

  it("drops a plus that is not at the front", () => {
    expect(telHref("020+1111908224")).toBe("tel:0201111908224");
  });

  it("survives a number that is already clean", () => {
    expect(telHref("01111908224")).toBe("tel:01111908224");
  });
});

describe("whatsappHref", () => {
  it("converts a local Egyptian mobile to international form", () => {
    // Dropping the zero without adding the country code opens a chat
    // with nobody, which is the failure worth pinning down.
    expect(whatsappHref("01111908224")).toBe("https://wa.me/201111908224");
    expect(whatsappHref("0111 190 8224")).toBe("https://wa.me/201111908224");
  });

  it("leaves a number that is already international alone", () => {
    expect(whatsappHref("201111908224")).toBe("https://wa.me/201111908224");
    expect(whatsappHref("+20 111 190 8224")).toBe("https://wa.me/201111908224");
  });

  it("handles the 00 international prefix", () => {
    expect(whatsappHref("00201111908224")).toBe("https://wa.me/201111908224");
  });

  it("adds the country code to a bare number", () => {
    expect(whatsappHref("1111908224")).toBe("https://wa.me/201111908224");
    // A landline with its trunk 0 left off, which dialable() cannot place.
    expect(whatsappHref("223456789")).toBe("https://wa.me/20223456789");
  });

  it("never puts 20 in front of another country's number", () => {
    expect(whatsappHref("+1 415 555 2671")).toBe("https://wa.me/14155552671");
  });

  it("never emits a plus, which wa.me rejects", () => {
    for (const input of ["+201111908224", "00201111908224", "0111 1908224"]) {
      expect(whatsappHref(input)).not.toContain("+");
    }
  });
});
