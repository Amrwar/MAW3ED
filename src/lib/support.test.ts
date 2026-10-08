import { describe, it, expect } from "vitest";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "./support";

/**
 * The contact page and the FAQ promise a reply at this address within
 * 24 hours. What is worth protecting is that the promise names a real
 * mailbox and names the same one everywhere.
 */

describe("the support address", () => {
  it("is a usable address, never empty", () => {
    // An unset NEXT_PUBLIC_SUPPORT_EMAIL must not render a contact
    // card with a blank value where an email should be.
    expect(SUPPORT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it("defaults to the production inbox", () => {
    // No env var is set in the test environment, so this proves the
    // fallback is the real address rather than a placeholder.
    expect(SUPPORT_EMAIL).toBe("support@maw3ed.net");
  });

  it("builds the mailto from the same value", () => {
    // Two definitions would eventually disagree, and the link would
    // point somewhere other than the address printed beside it.
    expect(SUPPORT_MAILTO).toBe(`mailto:${SUPPORT_EMAIL}`);
  });
});
