import { describe, it, expect } from "vitest";
import { redactPhones, scrubBreadcrumb, scrubEvent } from "./scrub";

describe("crash report scrubbing", () => {
  it("redacts phone numbers in free text", () => {
    expect(redactPhones("no account for +201012345678")).toBe("no account for [phone]");
    expect(redactPhones("call 010 1234 5678 now")).toBe("call [phone] now");
    expect(redactPhones("/api/x?phone=201012345678")).toBe("/api/x?phone=[phone]");
  });

  it("leaves short numbers, ids and versions alone", () => {
    expect(redactPhones("status 500 after 1200ms")).toBe("status 500 after 1200ms");
    expect(redactPhones("v0.1.0")).toBe("v0.1.0");
    expect(redactPhones("id 550e8400-e29b-41d4-a716-446655440000")).toBe("id 550e8400-e29b-41d4-a716-446655440000");
    expect(redactPhones("booking clx123456789abc")).toBe("booking clx123456789abc");
  });

  it("drops request bodies, headers and cookies", () => {
    const out = scrubEvent({
      request: {
        url: "https://www.maw3ed.net/api/x?p=+201012345678",
        data: '{"phone":"+201012345678"}',
        headers: { Authorization: "Bearer abc" },
        cookies: "a=b",
      },
    });
    expect(out.request).toEqual({ url: "https://www.maw3ed.net/api/x?p=[phone]" });
  });

  it("redacts messages, exception values and extra", () => {
    const out = scrubEvent({
      message: "for +201012345678",
      exception: { values: [{ value: "phone 01012345678 taken" }] },
      extra: { nested: { who: "+20 101 234 5678" } },
    });
    expect(out.message).toBe("for [phone]");
    expect(out.exception?.values?.[0]?.value).toBe("phone [phone] taken");
    expect(out.extra).toEqual({ nested: { who: "[phone]" } });
  });

  it("strips bodies and auth from breadcrumbs", () => {
    const crumb = scrubBreadcrumb({
      message: "sent to 01012345678",
      data: { url: "/api/a", method: "POST", request_body: "{...}", Authorization: "Bearer x", status_code: 200 },
    });
    expect(crumb).toEqual({ message: "sent to [phone]", data: { url: "/api/a", method: "POST", status_code: 200 } });
  });
});
