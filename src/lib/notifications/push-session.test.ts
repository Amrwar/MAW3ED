import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Push goes only to a person with a live app session (final audit F-03).
 * Signing out everywhere or resetting a password ended the sessions but
 * left the device tokens, so a lost phone kept showing bookings on its
 * lock screen indefinitely.
 */

const { state, sendExpoPush } = vi.hoisted(() => ({
  state: { liveSessions: 0, tokens: ["ExponentPushToken[abc]"] },
  sendExpoPush: vi.fn(async (messages: unknown[]) => ({ tickets: messages.map(() => ({ status: "ok" })), deadTokens: [] as string[] })),
}));

vi.mock("@/lib/db", () => ({
  db: {
    mobileSession: { count: vi.fn(async () => state.liveSessions) },
    deviceToken: {
      findMany: vi.fn(async () => state.tokens.map((token) => ({ token }))),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
  },
}));
vi.mock("@/lib/logger", () => ({ log: { warn: () => undefined, error: () => undefined, info: () => undefined } }));
vi.mock("@/lib/services/email", () => ({ sendEmail: async () => ({ ok: true }) }));
vi.mock("@/lib/services/whatsapp", () => ({ sendWhatsAppMessage: async () => ({ ok: true }) }));
vi.mock("@/lib/services/expo-push", () => ({ isExpoToken: () => true, sendExpoPush }));

import { pushChannel } from "./channels";
import type { Recipient } from "./recipients";

const recipient: Recipient = {
  audience: "customer",
  userId: "u1",
  phone: null,
  email: null,
  href: "/",
  allow: { inApp: true, email: false, whatsapp: false, sms: false, push: true },
};

const send = () =>
  pushChannel.send({
    event: { type: "booking.confirmed", bookingId: "b1" },
    recipient,
    copy: { title: "t", body: "b" },
    bookingId: "b1",
  } as Parameters<typeof pushChannel.send>[0]);

describe("push and app sessions", () => {
  beforeEach(() => {
    sendExpoPush.mockClear();
  });

  it("sends nothing when every app session has ended", async () => {
    state.liveSessions = 0;
    const out = await send();
    expect(out).toEqual({ ok: false, skipped: true, reason: "no-session" });
    expect(sendExpoPush).not.toHaveBeenCalled();
  });

  it("sends while the person is signed in on a phone", async () => {
    state.liveSessions = 1;
    const out = await send();
    expect(out.ok).toBe(true);
    expect(sendExpoPush).toHaveBeenCalledTimes(1);
  });
});
