import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

/**
 * Which address a mail comes from. Subscription mail is billing's (and a
 * reply goes there); everything else comes from noreply@ as before.
 */

const send = vi.fn();
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (...a: unknown[]) => send(...a) };
  },
}));

async function email() {
  vi.resetModules();
  vi.stubEnv("RESEND_API_KEY", "re_test_key_not_real");
  vi.stubEnv("EMAIL_FROM", "");
  vi.stubEnv("EMAIL_FROM_BILLING", "");
  return import("./email");
}

beforeEach(() => send.mockReset().mockResolvedValue({ data: { id: "m1" }, error: null }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("the sender of an email", () => {
  it("is noreply@ for ordinary mail, with no reply-to", async () => {
    const { sendEmail } = await email();
    await sendEmail({ to: "a@b.c", subject: "s", html: "h" });
    const arg = send.mock.calls[0][0];
    expect(arg.from).toBe("Maw3ed <noreply@maw3ed.net>");
    expect(arg.replyTo).toBeUndefined();
  });

  it("is billing@ for a subscription reminder, and replies go there", async () => {
    const { sendSubscriptionRenewalReminder } = await email();
    await sendSubscriptionRenewalReminder("owner@b.c", {
      businessName: "X", planName: "Pro", expiryDate: "2026-12-01", renewUrl: "https://maw3ed.net/r", daysLeft: 3,
    });
    const arg = send.mock.calls[0][0];
    expect(arg.from).toBe("Maw3ed Billing <billing@maw3ed.net>");
    expect(arg.replyTo).toBe("billing@maw3ed.net");
  });

  it("is billing@ for an expiry notice", async () => {
    const { sendSubscriptionExpiredEmail } = await email();
    await sendSubscriptionExpiredEmail("owner@b.c", { businessName: "X", planName: "Pro", renewUrl: "https://maw3ed.net/r" });
    expect(send.mock.calls[0][0].from).toBe("Maw3ed Billing <billing@maw3ed.net>");
  });
});
