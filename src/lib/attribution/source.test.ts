import { describe, it, expect } from "vitest";
import {
  LINKABLE_SOURCES,
  SOURCE_LABELS,
  SRC_PARAM,
  bookingLinkFor,
  resolveSource,
  sourceFromParam,
  sourceFromReferrer,
} from "./source";

describe("sourceFromParam", () => {
  it("reads the channels a business is given links for", () => {
    expect(sourceFromParam("instagram")).toBe("INSTAGRAM");
    expect(sourceFromParam("whatsapp")).toBe("WHATSAPP");
    expect(sourceFromParam("facebook")).toBe("FACEBOOK");
    expect(sourceFromParam("google")).toBe("GOOGLE");
    expect(sourceFromParam("website")).toBe("WEBSITE");
    expect(sourceFromParam("qr")).toBe("QR");
  });

  it("forgives the spellings people actually type", () => {
    expect(sourceFromParam("IG")).toBe("INSTAGRAM");
    expect(sourceFromParam(" Insta ")).toBe("INSTAGRAM");
    expect(sourceFromParam("FB")).toBe("FACEBOOK");
    expect(sourceFromParam("gmb")).toBe("GOOGLE");
    expect(sourceFromParam("wa")).toBe("WHATSAPP");
  });

  it("calls something unrecognised OTHER rather than DIRECT", () => {
    // A real visit from somewhere we do not have a name for. Calling it
    // direct would credit the wrong channel with a booking.
    expect(sourceFromParam("tiktok-bio")).toBe("OTHER");
    expect(sourceFromParam("newsletter")).toBe("OTHER");
  });

  it("is null when there is no parameter at all", () => {
    expect(sourceFromParam(null)).toBeNull();
    expect(sourceFromParam(undefined)).toBeNull();
    expect(sourceFromParam("")).toBeNull();
    expect(sourceFromParam("   ")).toBeNull();
  });
});

describe("sourceFromReferrer", () => {
  it("recognises the networks that keep a referrer", () => {
    expect(sourceFromReferrer("https://www.instagram.com/")).toBe("INSTAGRAM");
    expect(sourceFromReferrer("https://l.instagram.com/?u=x")).toBe("INSTAGRAM");
    expect(sourceFromReferrer("https://m.facebook.com/")).toBe("FACEBOOK");
    expect(sourceFromReferrer("https://wa.me/")).toBe("WHATSAPP");
    expect(sourceFromReferrer("https://www.google.com/search?q=x")).toBe("GOOGLE");
    expect(sourceFromReferrer("https://www.google.com.eg/")).toBe("GOOGLE");
  });

  it("is not fooled by a lookalike host", () => {
    // notinstagram.com must not be credited to Instagram.
    expect(sourceFromReferrer("https://notinstagram.com/")).toBeNull();
    expect(sourceFromReferrer("https://instagram.com.evil.test/")).toBeNull();
    expect(sourceFromReferrer("https://fakegoogle.net/")).toBeNull();
  });

  it("survives a referrer that is not a URL", () => {
    expect(sourceFromReferrer("not a url")).toBeNull();
    expect(sourceFromReferrer("")).toBeNull();
    expect(sourceFromReferrer(null)).toBeNull();
  });
});

describe("resolveSource", () => {
  const ownHosts = ["maw3ed.net", "localhost"];

  it("believes the link over the referrer", () => {
    // A QR card opened from a browser that reports Instagram is still
    // the card: the business printed the source into the link.
    expect(
      resolveSource({ src: "qr", referrer: "https://www.instagram.com/", ownHosts }),
    ).toBe("QR");
  });

  it("falls back to the referrer when the link said nothing", () => {
    expect(resolveSource({ referrer: "https://www.instagram.com/", ownHosts })).toBe("INSTAGRAM");
  });

  it("counts our own pages as internal, not as a channel", () => {
    // Otherwise every visitor who browsed the marketplace first would
    // be credited to "other", and the business would think an unknown
    // channel was working.
    expect(resolveSource({ referrer: "https://maw3ed.net/businesses", ownHosts })).toBe("MAW3ED");
    expect(resolveSource({ referrer: "https://www.maw3ed.net/cairo/clinics", ownHosts })).toBe(
      "MAW3ED",
    );
  });

  it("says DIRECT when it genuinely does not know", () => {
    expect(resolveSource({ ownHosts })).toBe("DIRECT");
    expect(resolveSource({ src: null, referrer: null, ownHosts })).toBe("DIRECT");
  });

  it("never returns something outside the enum", () => {
    for (const input of ["", "   ", "ig", "nonsense", "🙂"]) {
      const result = resolveSource({ src: input, ownHosts });
      expect(Object.keys(SOURCE_LABELS)).toContain(result);
    }
  });
});

describe("bookingLinkFor", () => {
  it("builds a link per channel", () => {
    expect(bookingLinkFor("https://maw3ed.net", "salah-barbershop", "INSTAGRAM")).toBe(
      "https://maw3ed.net/company/salah-barbershop?src=instagram",
    );
  });

  it("does not double the slash on a base that ends in one", () => {
    expect(bookingLinkFor("https://maw3ed.net/", "x", "QR")).toBe(
      "https://maw3ed.net/company/x?src=qr",
    );
  });

  it("round-trips: every link it builds parses back to its own channel", () => {
    for (const source of LINKABLE_SOURCES) {
      const link = bookingLinkFor("https://maw3ed.net", "slug", source);
      const param = new URL(link).searchParams.get("src");
      expect(sourceFromParam(param), source).toBe(source);
    }
  });
});

describe("the channel list", () => {
  it("has a param and a label for every linkable channel", () => {
    for (const source of LINKABLE_SOURCES) {
      expect(SRC_PARAM[source]).toBeTruthy();
      expect(SOURCE_LABELS[source].ar).toBeTruthy();
      expect(SOURCE_LABELS[source].en).toBeTruthy();
    }
  });

  it("labels every source the database can store", () => {
    // Or the dashboard renders a blank row for a real channel.
    const stored = [
      "DIRECT", "INSTAGRAM", "WHATSAPP", "FACEBOOK",
      "GOOGLE", "WEBSITE", "QR", "MAW3ED", "OTHER",
    ] as const;
    for (const s of stored) expect(SOURCE_LABELS[s]).toBeDefined();
  });
});
