import { describe, it, expect } from "vitest";
import {
  customerConfirmationHtml,
  customerReminderHtml,
  businessAlertHtml,
  subscriptionRenewalReminderHtml,
  subscriptionExpiredHtml,
  emailVerificationHtml,
} from "./email-templates";

/**
 * Names arrive from public forms and land in somebody else's inbox.
 *
 * The booking form takes any name, so an anonymous visitor could book
 * as `<a href="https://evil">اضغط هنا</a>` and have a working link,
 * framed by our layout, delivered to the business owner. Every template
 * must print the name as text.
 */

const EVIL = `<a href="https://evil.example">اضغط هنا</a>`;
const ESCAPED = `&lt;a href=&quot;https://evil.example&quot;&gt;اضغط هنا&lt;/a&gt;`;

const booking = {
  businessName: EVIL,
  serviceName: EVIL,
  date: "2026-10-20",
  startTime: "10:00",
  endTime: "10:30",
  customerName: EVIL,
  customerPhone: "01000000000",
  totalPrice: 100,
  currency: "EGP",
  notes: EVIL,
  bookingUrl: "https://www.maw3ed.net/booking/abc",
};

function assertSafe(html: string) {
  expect(html).not.toContain(`href="https://evil.example"`);
  expect(html).not.toContain("<a href=\"https://evil");
  expect(html).toContain(ESCAPED);
}

describe("email templates escape interpolated names", () => {
  it("customer confirmation", () => assertSafe(customerConfirmationHtml(booking)));
  it("customer reminder", () => assertSafe(customerReminderHtml(booking)));
  it("business alert", () => assertSafe(businessAlertHtml(booking)));

  it("subscription renewal reminder", () =>
    assertSafe(
      subscriptionRenewalReminderHtml({
        businessName: EVIL,
        planName: EVIL,
        expiryDate: "2026-11-01",
        renewUrl: "https://www.maw3ed.net/dashboard/billing",
        daysLeft: 3,
      }),
    ));

  it("subscription expired", () =>
    assertSafe(
      subscriptionExpiredHtml({
        businessName: EVIL,
        planName: EVIL,
        renewUrl: "https://www.maw3ed.net/dashboard/billing",
      }),
    ));

  it("email verification greeting", () =>
    assertSafe(emailVerificationHtml("https://www.maw3ed.net/verify?t=x", EVIL)));

  it("a quote in a URL cannot break out of the href attribute", () => {
    const html = customerConfirmationHtml({
      ...booking,
      bookingUrl: `https://www.maw3ed.net/b" onclick="x`,
    });
    expect(html).not.toContain(`" onclick="x`);
    expect(html).toContain(`&quot; onclick=&quot;x`);
  });
});
