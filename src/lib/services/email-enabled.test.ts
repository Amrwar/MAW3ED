import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * Whether a send will be attempted at all.
 *
 * This is the switch three routes consult before telling somebody to go
 * and look in their inbox. Getting it wrong in one direction means
 * "check your email" for a password reset that was never handed to a
 * provider; in the other it means refusing to send when sending would
 * have worked.
 *
 * The module decides once at import, so each case re-imports it with a
 * different environment.
 */

async function freshIsEmailEnabled(key: string | undefined) {
  vi.resetModules();
  if (key === undefined) vi.stubEnv("RESEND_API_KEY", "");
  else vi.stubEnv("RESEND_API_KEY", key);
  const mod = await import("./email");
  return mod.isEmailEnabled();
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("whether email is enabled", () => {
  it("is false with no API key", async () => {
    // The case that mattered: routes used to return { sent: true } here.
    expect(await freshIsEmailEnabled(undefined)).toBe(false);
  });

  it("is true with an API key", async () => {
    expect(await freshIsEmailEnabled("re_test_key_not_real")).toBe(true);
  });

  it("does not require EMAIL_FROM", async () => {
    // EMAIL_FROM has a working default, so demanding it here would
    // refuse sends that currently succeed. getIntegrations().email
    // asks for both on purpose and answers a different question.
    vi.stubEnv("EMAIL_FROM", "");
    expect(await freshIsEmailEnabled("re_test_key_not_real")).toBe(true);
  });
});
