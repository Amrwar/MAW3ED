import { describe, expect, it } from "vitest";
import { contactFieldErrors, contactSchema, isTrapped, CONTACT_MESSAGE_MAX } from "./form";
import { contactMessageHtml } from "@/lib/services/email-templates";

const good = {
  name: "Mona Adel",
  email: "  Mona@Example.com ",
  role: "customer",
  topic: "booking",
  message: "My booking did not show up in my account.",
};

describe("contact form rules", () => {
  it("accepts a normal message and normalises the email", () => {
    const r = contactSchema.safeParse(good);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("mona@example.com");
      expect(r.data.phone).toBeUndefined();
    }
  });

  it("keeps a real phone and drops an empty one", () => {
    expect(contactSchema.parse({ ...good, phone: "+20 100 123 4567" }).phone).toBe("+20 100 123 4567");
    expect(contactSchema.parse({ ...good, phone: "   " }).phone).toBeUndefined();
    expect(contactSchema.safeParse({ ...good, phone: "call me maybe" }).success).toBe(false);
  });

  it("refuses missing, short or oversized fields and says which", () => {
    const r = contactSchema.safeParse({ ...good, name: "M", email: "nope", message: "short" });
    expect(r.success).toBe(false);
    if (!r.success) expect(contactFieldErrors(r.error)).toEqual({ name: true, email: true, message: true });
    expect(contactSchema.safeParse({ ...good, message: "x".repeat(CONTACT_MESSAGE_MAX + 1) }).success).toBe(false);
    expect(contactSchema.safeParse({ ...good, topic: "spam" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...good, role: "admin" }).success).toBe(false);
  });

  it("spots the trap field only when filled", () => {
    expect(isTrapped({ ...good, website: "http://spam.example" })).toBe(true);
    expect(isTrapped({ ...good, website: "" })).toBe(false);
    expect(isTrapped(good)).toBe(false);
    expect(isTrapped(null)).toBe(false);
  });
});

describe("contact email", () => {
  it("escapes everything the visitor typed", () => {
    const html = contactMessageHtml({
      name: "<script>alert(1)</script>",
      email: "a@b.co",
      role: "Customer",
      topic: "Other",
      message: "<img src=x onerror=alert(1)>",
      lang: "en",
      sentAt: new Date("2026-11-06T10:00:00Z"),
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("2026-11-06 10:00 UTC");
  });
});
