import { describe, expect, it } from "vitest";
import { authErrorKey } from "./error-key";
import { translations } from "@/lib/i18n";
import { webUrl } from "@/lib/social-links";

describe("the ?error= NextAuth comes back with", () => {
  it("says nothing when there is none", () => {
    expect(authErrorKey(null)).toBeNull();
    expect(authErrorKey("")).toBeNull();
  });

  it("explains the ones a Google sign-in can end in", () => {
    expect(authErrorKey("OAuthAccountNotLinked")).toBe("OAuthAccountNotLinked");
    expect(authErrorKey("AccountNotLinked")).toBe("OAuthAccountNotLinked");
    expect(authErrorKey("AccessDenied")).toBe("AccessDenied");
    expect(authErrorKey("OAuthCallbackError")).toBe("OAuthCallbackError");
    expect(authErrorKey("Configuration")).toBe("Configuration");
    expect(authErrorKey("EmailUnverified")).toBe("EmailUnverified");
    expect(authErrorKey("SignedIn")).toBe("SignedIn");
  });

  it("never echoes whatever else is in the address bar", () => {
    expect(authErrorKey("<script>alert(1)</script>")).toBe("generic");
    expect(authErrorKey("MissingCSRF")).toBe("generic");
  });

  it("has words for every key, in both languages", () => {
    for (const key of ["OAuthAccountNotLinked", "AccessDenied", "EmailUnverified", "SignedIn", "OAuthCallbackError", "Configuration", "generic"] as const) {
      expect(translations.ar.auth.errors[key]).toMatch(/\S/);
      expect(translations.en.auth.errors[key]).toMatch(/\S/);
    }
  });
});

describe("the Follow us links", () => {
  it("uses only web addresses", () => {
    expect(webUrl("https://www.instagram.com/maw3ed")).toBe("https://www.instagram.com/maw3ed");
    expect(webUrl(" https://facebook.com/maw3ed ")).toBe("https://facebook.com/maw3ed");
    expect(webUrl("javascript:alert(1)")).toBeNull();
    expect(webUrl("instagram.com/maw3ed")).toBeNull();
    expect(webUrl("")).toBeNull();
    expect(webUrl(undefined)).toBeNull();
  });
});
