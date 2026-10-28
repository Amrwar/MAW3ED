import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issuePhoneProof, phoneProofRequired, readPhoneProof } from "./phone-proof";

describe("phone proof", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-secret-for-phone-proof-at-least-32-chars");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("reads back the number it was issued for", async () => {
    const token = await issuePhoneProof("201012345678");
    expect(await readPhoneProof(token)).toBe("201012345678");
  });

  it("refuses a token signed with another secret", async () => {
    const token = await issuePhoneProof("201012345678");
    vi.stubEnv("AUTH_SECRET", "a-different-secret-entirely-also-32-chars");
    expect(await readPhoneProof(token)).toBeNull();
  });

  it("refuses nothing, junk and an expired proof", async () => {
    expect(await readPhoneProof(undefined)).toBeNull();
    expect(await readPhoneProof("not.a.token")).toBeNull();

    vi.useFakeTimers();
    const token = await issuePhoneProof("201012345678");
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    expect(await readPhoneProof(token)).toBeNull();
  });

  it("is off unless switched on with 1", () => {
    vi.stubEnv("BOOKING_PHONE_VERIFICATION", "");
    expect(phoneProofRequired()).toBe(false);
    vi.stubEnv("BOOKING_PHONE_VERIFICATION", "true");
    expect(phoneProofRequired()).toBe(false);
    vi.stubEnv("BOOKING_PHONE_VERIFICATION", "1");
    expect(phoneProofRequired()).toBe(true);
  });
});
