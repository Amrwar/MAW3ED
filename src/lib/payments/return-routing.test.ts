import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Where Paymob sends somebody back to, and what is waiting there.
 *
 * The return URL is a single setting in the Paymob dashboard. Nothing
 * in the code can vary it per payment — getPaymentKey sends no
 * return_url — so every payment comes back to the same page, whether it
 * was for a booking or a subscription.
 *
 * That page looked up a Booking by merchant_order_id. A subscription's
 * is `sub_{businessId}_{plan}_{timestamp}`, which matches no booking,
 * so an owner who had just paid was told "الحجز غير موجود" — a booking
 * they never made, missing. It said that whether the payment had
 * succeeded or failed, so a success looked like a failure.
 *
 * Reported from production, by somebody trying to pay.
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/** The prefix createSubscriptionPaymentSession builds. */
const SUBSCRIPTION_PREFIX = "sub_";

describe("the subscription order id", () => {
  it("is still built with the prefix the return page keys on", () => {
    // If this format changes, the routing below stops working and the
    // old bug comes back silently.
    const source = read("src/lib/services/paymob.ts");
    expect(source).toMatch(/merchantOrderId\s*=\s*`sub_\$\{businessId\}_\$\{plan\}_\$\{Date\.now\(\)\}`/);
  });

  it("cannot be mistaken for a booking id", () => {
    // Booking ids are cuids: no underscores, never this prefix.
    const cuid = "cmuzxwd9f000iw4ntz8pv3c51";
    expect(cuid.startsWith(SUBSCRIPTION_PREFIX)).toBe(false);
  });
});

describe("the shared return page", () => {
  const source = read("src/app/payment/return/page.tsx");

  it("routes a subscription away before looking for a booking", () => {
    expect(source).toContain('startsWith("sub_")');

    // Order matters: the check has to come before the lookup, or the
    // page still fails to find a booking first.
    const guard = source.indexOf('startsWith("sub_")');
    const lookup = source.indexOf("db.booking.findUnique");
    expect(guard).toBeGreaterThan(-1);
    expect(lookup).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(lookup);
  });

  it("carries Paymob's query string across", () => {
    // The subscription page should see exactly what Paymob sent, not a
    // bare redirect that loses success/pending/transaction id.
    expect(source).toContain("URLSearchParams");
    expect(source).toMatch(/redirect\(`\/payment\/subscription\/return/);
  });

  it("still handles a booking return", () => {
    expect(source).toContain("db.booking.findUnique");
  });
});

describe("both return pages exist", () => {
  it("has one for bookings and one for subscriptions", () => {
    // A redirect to a page that is not there would turn one bad
    // message into a 404.
    expect(() => read("src/app/payment/return/page.tsx")).not.toThrow();
    expect(() => read("src/app/payment/subscription/return/page.tsx")).not.toThrow();
  });

  it("reads subscription state from the database, not the query string", () => {
    // Same rule as the booking page: Paymob's ?success= is a claim by
    // the browser, and only the webhook may decide a payment succeeded.
    const source = read("src/app/payment/subscription/return/page.tsx");
    expect(source).toContain("db.business.findUnique");
    expect(source).toContain("subscriptionStatus");
  });
});
