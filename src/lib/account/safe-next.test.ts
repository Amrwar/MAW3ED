import { describe, expect, it } from "vitest";

import { safeNext } from "./safe-next";

describe("safeNext", () => {
  it("keeps a path on this site, with its query", () => {
    expect(safeNext("/account/favorites")).toBe("/account/favorites");
    expect(safeNext("/account/history?page=3")).toBe("/account/history?page=3");
  });

  it("falls back to the account home when there is nothing to go on", () => {
    expect(safeNext(null)).toBe("/account");
    expect(safeNext(undefined)).toBe("/account");
    expect(safeNext("")).toBe("/account");
    expect(safeNext("   ")).toBe("/account");
  });

  it("refuses to send a customer to another site", () => {
    // Each of these would be a phishing hand-off at the one moment the
    // customer has just proved their phone and trusts the page.
    for (const hostile of [
      "https://not-maw3ed.example",
      "http://not-maw3ed.example/account",
      "//not-maw3ed.example",
      "///not-maw3ed.example",
      "\\\\not-maw3ed.example",
      "/\\not-maw3ed.example",
      "/\t/not-maw3ed.example",
      "javascript:alert(1)",
      "mailto:someone@example.com",
      "data:text/html,<script>alert(1)</script>",
      " https://not-maw3ed.example",
      "\u0000//not-maw3ed.example",
    ]) {
      expect(safeNext(hostile), hostile).toBe("/account");
    }
  });

  it("does not mistake a path that merely mentions a scheme for one", () => {
    expect(safeNext("/account/history?from=https://maw3ed.net")).toBe(
      "/account/history?from=https://maw3ed.net",
    );
  });
});
